from typing import Dict, Any, Optional
from datetime import datetime
import uuid
import json
from langchain.agents import create_react_agent, AgentExecutor
from langchain.tools import Tool
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI, HarmBlockThreshold, HarmCategory
from config import settings
from scripts.google_drive import GoogleDriveService
from utils.logger import logger
from utils.user_security import get_security_service
from langchain.chains import RetrievalQA
from scripts.chroma import vectorstore
import asyncio
from services.additional_tools import (
    get_file_metadata_table,
    suggest_folder_structure,
    organize_drive_by_gemini,
)
from utils.sanitize import extract_json_from_string


class GoogleDriveAgent:
    def __init__(self, user_id: Optional[str] = None, user_supabase_client=None, llm=None):
        self.drive_service = GoogleDriveService()
        self.user_id = user_id or "anonymous"
        self.user_supabase = user_supabase_client
        self.security_service = get_security_service(user_supabase_client) if user_supabase_client else None
        self.llm = self._init_llm(llm)
        self.memory = ConversationBufferMemory(
            memory_key="chat_history", 
            return_messages=True,
            output_key="output"
        )
        self.agent_executor = self._create_agent()
        self.permissions = user_supabase_client.table("profiles").select("permissions").eq("id", self.user_id).limit(1).execute().data[0].get("permissions", []) if user_supabase_client else []
        self.version_id = None

    def _init_llm(self, llm):
        """Initialize the LLM if not provided"""
        if llm is None:
            return ChatGoogleGenerativeAI(
                google_api_key=getattr(settings, "GEMINI_API_KEY", None),
                model="gemini-2.0-flash-exp",
                temperature=0.7,
                top_p=0.8,
                top_k=40,
                max_output_tokens=2048,
                safety_settings={
                    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
            )
        return llm

    def _track_change(self, id: str, change_type: str, old_path: str = None, new_path: str = None, metadata: Dict[str, Any] = None) -> None:
        """Track changes to Google Drive"""
        if not self.user_supabase or not self.user_id:
            return
        try:
            version_id = self._get_or_create_version(f"{change_type.title()} operation")
            change_data = {
                "version_id": version_id,
                "type": change_type,
                "original_path": old_path,
                "new_path": new_path,
                "description": f"{change_type} operation on {old_path}",
                "user_id": self.user_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            self.user_supabase.table("changes").insert(change_data).execute()
            # Update file_metadata for folder changes
            if change_type in ("added", "modified") and metadata:
                # Insert or update folder metadata
                self.user_supabase.table("file_metadata").upsert({
                    "id": id,
                    "file_type": True,
                    "file_name": metadata.get("file_name"),
                    "file_path": metadata.get("file_path"),
                    "summary": metadata.get("summary", ""),
                    "tags": metadata.get("tags", []),
                    "updated_at": datetime.utcnow().isoformat()
                }).execute()
            elif change_type == "deleted" and metadata:
                # Remove folder metadata
                self.user_supabase.table("file_metadata").delete().eq("file_name", metadata.get("file_name")).eq("file_type", True).eq("file_path", metadata.get("file_path")).execute()
        except Exception as e:
            logger.error(f"Error tracking change: {e}")

    def _get_or_create_version(self, description: str) -> str:
        """Create a new version if version_id is None, otherwise return the current version id"""
        try:
            if self.version_id:
                return self.version_id
            version_data = {
                "version": f"v{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                "title": "Drive Changes",
                "description": description,
                "user_id": self.user_id,
                "created_at": datetime.utcnow().isoformat(),
                "timestamp": datetime.utcnow().isoformat(),
                "data": {}
            }
            version_response = self.user_supabase.table("versions").insert(version_data).execute()
            self.version_id = version_response.data[0]["id"]
            return self.version_id
        except Exception as e:
            logger.error(f"Error creating version entry: {e}")
            return str(uuid.uuid4())

    def _parse_tool_input(self, input_str: str) -> Dict[str, Any]:
        """Safely parse tool input"""
        if not input_str:
            return {}
        # Handle string inputs that are already JSON-like
        input_str = input_str.strip()
        # If it looks like a dict string, try to parse it
        if input_str.startswith('{') and input_str.endswith('}'):
            try:
                return json.loads(input_str.replace("'", '"'))
            except json.JSONDecodeError:
                try:
                    # Fallback to eval for simple dict strings
                    return eval(input_str)
                except:
                    return {}
        # Handle simple string inputs
        return {"query": input_str}

    def _wrap_drive_tool(self, func, operation: str, change_type: str = None):
        """Wrap drive tools with permission checks and change tracking"""
        def wrapped_func(input_str):
            try:
                args = self._parse_tool_input(input_str)
                # Check write permission for operations that modify drive
                if operation in ["create_folder", "move_file", "delete_file", "rename_file"]:
                    if not ("write" in self.permissions):
                        return json.dumps({"error": f"Permission denied: 'write' permission required for {operation}"})
                # Execute the original function
                result = func(**args)
                # Track changes for specified operations
                if change_type and operation in ["create_folder", "move_file", "delete_file", "rename_file"]:
                    if operation == "create_folder":
                        self._track_change(
                            id=args.get("folder_id", str(uuid.uuid4())),
                            change_type="added",
                            old_path=args.get("folder_name", ""),
                            new_path=args.get("folder_name", ""),
                            metadata={
                                "file_name": args.get("folder_name", ""),
                                "file_path": args.get("parent_ids", [self.drive_service.get_default_folder_id()])[0] if args.get("parent_ids") else self.drive_service.get_default_folder_id(),
                                "summary": f"Created folder: {args.get('folder_name', '')}",
                                "tags": ["folder", "created"]
                            }
                        )
                    elif operation == "move_file":
                        self._track_change(
                            id=args.get("file_id", str(uuid.uuid4())),
                            change_type="modified",
                            old_path=args.get("file_id", ""),
                            new_path=args.get("new_parent_id", ""),
                            metadata={
                                "file_name": args.get("file_id", ""),
                                "file_path": args.get("new_parent_id", ""),
                                "summary": f"Moved file {args.get('file_id', '')} to {args.get('new_parent_id', '')}",
                                "tags": ["file", "moved"]
                            }
                        )
                    elif operation == "delete_file":
                        self._track_change(
                            id=args.get("file_id", str(uuid.uuid4())),
                            change_type="deleted",
                            old_path=args.get("file_id", ""),
                            new_path=None,
                            metadata={
                                "file_name": args.get("file_id", ""),
                                "file_path": "",
                                "summary": f"Deleted file: {args.get('file_id', '')}",
                                "tags": ["file", "deleted"]
                            }
                        )
                    elif operation == "rename_file":
                        self._track_change(
                            id=args.get("file_id", str(uuid.uuid4())),
                            change_type="modified",
                            old_path=args.get("file_id", ""),
                            new_path=args.get("new_name", ""),
                            metadata={
                                "file_name": args.get("new_name", ""),
                                "file_path": args.get("file_id", ""),
                                "summary": f"Renamed file {args.get('file_id', '')} to {args.get('new_name', '')}",
                                "tags": ["file", "renamed"]
                            }
                        )
                return json.dumps(result) if isinstance(result, (dict, list)) else str(result)
            except Exception as e:
                logger.error(f"Error in tool {operation}: {e}")
                return json.dumps({"error": str(e)})
        return wrapped_func

    def _create_agent(self):
        """Create the agent with modern LangChain patterns"""
        # RAG: Build retriever and QA chain
        retriever = vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 5})
        qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            retriever=retriever,
            return_source_documents=True
        )
        
        def doc_qa_tool(input_text):
            result = qa_chain.invoke({"query": input_text})
            return result['result']

        def organize_drive_tool(input_str):
            """Handle organize drive tool with proper input parsing"""
            args = self._parse_tool_input(input_str)
            prompt = args.get("prompt", input_str)
            folder_id = args.get("folder_id", self.drive_service.get_default_folder_id())
            return organize_drive_by_gemini(self.drive_service.service, folder_id, prompt, self.user_supabase)

        tools = [
            Tool(
                name="ListAllItems",
                func=self.drive_service.list_files_recursively,
                description="Recursively list all files and folders starting from folder_id (None = all accessible files/folders). Input: JSON with 'folder_id' (optional). Returns a flat list of all items."
            ),
            Tool(
                name="ListFilesInFolder",
                func=self.drive_service.list_files_in_folder,
                description="List files in Google Drive folder without going into subfolders. Input: JSON with 'folder_id' (optional), 'folder_name' (optional). If neither provided, lists all accessible files."
            ),
            Tool(
                name="GetFileInfo",
                func=self.drive_service.get_file_info,
                description="Search for files by name or file id. Input: JSON with 'file_id' (optional) or 'file_name' (optional), 'max_results' (optional, default 50). If neither provided, returns default shared folder info."
            ),
            Tool(
                name="CreateFolder",
                func=self._wrap_drive_tool(self.drive_service.create_folder, "create_folder", "added"),
                description="Create a new folder. Input: JSON with 'folder_name' (required), 'parent_ids' (optional list), 'parent_names' (optional list). Requires 'write' permission."
            ),
            Tool(
                name="MoveFile",
                func=self._wrap_drive_tool(self.drive_service.move_file, "move_file", "modified"),
                description="Move a file to a different folder. Input: JSON with 'new_parent_id' (required), 'file_id' (optional), 'file_name' (optional), 'old_parent_id' (optional). Requires 'write' permission."
            ),
            Tool(
                name="RenameFile",
                func=self._wrap_drive_tool(self.drive_service.rename_file, "rename_file", "modified"),
                description="Rename a file or folder. Input: JSON with 'new_name' (required), 'file_id' (optional), 'file_name' (optional). Requires 'write' permission."
            ),
            Tool(
                name="DeleteFile",
                func=self._wrap_drive_tool(self.drive_service.delete_file, "delete_file", "deleted"),
                description="Delete a file (move to trash). Input: JSON with 'file_id' (required). Requires 'write' permission."
            ),
            Tool(
                name="GetStorageInfo",
                func=self.drive_service.get_storage_info,
                description="Get Google Drive storage information including user details and storage quota. No input required."
            ),
            Tool(
                name="GetFolderStructure",
                func=lambda inp: self.drive_service.get_folder_structure(
                    folder_id=self._parse_tool_input(inp).get("folder_id") if inp else None,
                    max_depth=self._parse_tool_input(inp).get("max_depth", 3) if inp else 3
                ),
                description="Get folder structure. Input: 'folder_id' (optional, defaults to top-level shared folder if not provided) and 'max_depth' (optional, default 3). Returns hierarchical structure of the folder and its children."
            ),
            Tool(
                name="DocRetriever",
                func=doc_qa_tool,
                description="Use this tool to answer questions about the documents in the drive. Input: question string"
            ),
            Tool(
                name="GetFileMetadataTable",
                func=lambda _: json.dumps(get_file_metadata_table()),
                description="Fetch all files/folder information or metadata records from Supabase. This information can be used to classify or organize files or get insights/overview of the files/folders in the drive. Input: empty string. Returns JSON list of file metadata records."
            ),
            Tool(
                name="GetDefaultFolderId",
                func=self.drive_service.get_default_folder_id,
                description="Get the default folder ID for service account operations (shared with the service account). No input required."
            ),
            Tool(
                name="SuggestFolderStructure",
                func=lambda input_str: suggest_folder_structure(input_str if input_str else "Suggest a folder structure for my drive based on my files."),
                description="Classify or Suggest a nested folders/files structure for the drive based on all files metadata information. Input: user prompt string. Returns a consistent JSON structure."
            ),
            # Tool(
            #     name="OrganizeDriveByGeminiStructure",
            #     func=organize_drive_tool,
            #     description="Organize Google Drive folders according to Gemini's suggested structure. Input: JSON with 'prompt' and 'folder_id' (defaults to shared folder). Only folders/subfolders are changed."
            # ),
        ]
        template = """You are a helpful Google Drive management assistant. You have access to various tools to help users manage, classify and organize their Google Drive files and folders.

TOOLS:
------
You have access to the following tools:

{tools}

To use a tool, use the following format:

Thought: Do I need to use a tool? Yes
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action

When you have a response to say to the Human, or if you do not need to use a tool, you MUST use the format:

Thought: Do I need to use a tool? No
Final Answer: [your response here]

Previous conversation history:
{chat_history}

New input: {input}
{agent_scratchpad}"""
        prompt = PromptTemplate(
            template=template,
            input_variables=["input", "chat_history", "agent_scratchpad", "tools", "tool_names"]
        )
        # Create the agent
        agent = create_react_agent(self.llm, tools, prompt)
        # Create the agent executor with better error handling
        agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            memory=self.memory,
            verbose=True,
            handle_parsing_errors="Check your output and make sure it conforms to the expected format. Use the Action/Action Input format without any JSON wrapping.",
            max_iterations=100,
            return_intermediate_steps=False
        )
        return agent_executor

    def process_message(self, message: str) -> dict:
        """Process user message using the modern invoke method and return JSON output with context_summary and ai_response generated by the agent/LLM"""
        try:
            logger.info(f"Processing user message for user {self.user_id}: {message}")
            chat_history = ""
            if hasattr(self.memory, 'chat_memory') and hasattr(self.memory.chat_memory, 'messages'):
                history_messages = self.memory.chat_memory.messages[-5:]
                for msg in history_messages:
                    if hasattr(msg, 'content'):
                        role = "Human" if msg.__class__.__name__ == "HumanMessage" else "Assistant"
                        chat_history += f"{role}: {msg.content}\n"
            result = self.agent_executor.invoke({
                "input": message,
                "chat_history": chat_history
            })
            context_summary = ""
            ai_response = ""
            # Try to extract context_summary and ai_response from result
            if isinstance(result, dict):
                # If agent returns keys directly
                context_summary = result.get("context_summary", "")
                ai_response = result.get("ai_response", result.get("output", result.get("result", str(result))))
            else:
                output = extract_json_from_string(result)
                # Try to parse output as JSON
                try:
                    parsed = json.loads(output)
                    context_summary = parsed.get("context_summary", "")
                    ai_response = parsed.get("ai_response", parsed.get("response", output))
                except Exception:
                    ai_response = output
            # Fallback: if context_summary is empty, use chat_history
            if not context_summary:
                context_summary = chat_history.strip()
            response_json = {
                "context_summary": context_summary,
                "ai_response": ai_response
            }
            return response_json
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            response_json = {
                "context_summary": "",
                "ai_response": f"I encountered an error: {str(e)}. Please try again or rephrase your request."
            }
            return response_json

    async def aprocess_message(self, message: str) -> dict:
        """Async wrapper for process_message"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.process_message, message)


def create_drive_agent(user_id: str = None, user_supabase_client=None, llm=None) -> GoogleDriveAgent:
    """Factory function to create a GoogleDriveAgent instance"""
    return GoogleDriveAgent(user_id=user_id, user_supabase_client=user_supabase_client, llm=llm)