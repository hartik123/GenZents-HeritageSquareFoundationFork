from typing import Dict, Any, Optional
from datetime import datetime
import uuid
import json
from langchain.agents import create_react_agent, AgentExecutor
from langchain.tools import Tool
from langchain.memory import ConversationBufferMemory
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
    suggest_folder_structure_with_gemini,
    organize_drive_by_gemini,
)


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

    def _permission_check(self, operation: str, resource_path: str = "") -> bool:
        """Check if user has permission to perform operation"""
        if not self.user_supabase or not self.user_id:
            logger.warning(f"No supabase client or user_id provided for permission check")
            return True  # Allow operations if no auth system is set up
        try:
            # Fetch user profile from Supabase - note: using 'permissions' (plural)
            profile_resp = self.user_supabase.table("profiles").select("permissions").eq("id", self.user_id).limit(1).execute()
            if not profile_resp.data or not profile_resp.data[0].get("permissions"):
                logger.warning(f"No permissions found for user {self.user_id}")
                return False
            permission = profile_resp.data[0]["permissions"]
            # Define which operations require write
            write_ops = {"read", "write"}
            if operation in write_ops:
                return permission == "write"
            # All other operations allowed for read or write
            return permission in ("read", "write")
        except Exception as e:
            logger.error(f"Error checking permissions for user {self.user_id}: {e}")
            return False

    def _track_change(self, change_type: str, resource_path: str, old_path: str = None, new_path: str = None, metadata: Dict[str, Any] = None) -> None:
        """Track changes to Google Drive"""
        if not self.user_supabase or not self.user_id:
            return
        try:
            version_id = self._get_or_create_version(resource_path, f"{change_type.title()} operation")
            change_data = {
                "version_id": version_id,
                "type": self._map_change_type(change_type),
                "original_path": old_path or resource_path,
                "new_path": new_path,
                "description": f"{change_type} operation on {resource_path}",
                "user_id": self.user_id,
                "timestamp": datetime.utcnow().isoformat()
            }
            self.user_supabase.table("changes").insert(change_data).execute()
            # Update file_metadata for folder changes
            if change_type in ("create", "rename", "move", "organize", "update") and metadata:
                # Insert or update folder metadata
                self.user_supabase.table("file_metadata").upsert({
                    "file_type": True,
                    "file_name": metadata.get("file_name"),
                    "file_path": metadata.get("file_path"),
                    "summary": metadata.get("summary", ""),
                    "tags": metadata.get("tags", []),
                    "updated_at": datetime.utcnow().isoformat()
                }).execute()
            elif change_type == "delete" and metadata:
                # Remove folder metadata
                self.user_supabase.table("file_metadata").delete().eq("file_name", metadata.get("file_name")).eq("file_type", True).eq("file_path", metadata.get("file_path")).execute()
            logger.info(f"Tracked change: {change_type} on {resource_path}")
        except Exception as e:
            logger.error(f"Error tracking change: {e}")

    def _map_change_type(self, change_type: str) -> str:
        """Map change types to standard format"""
        mapping = {
            "create": "added",
            "update": "modified",
            "delete": "deleted",
            "move": "modified",
            "rename": "modified",
            "organize": "modified"
        }
        return mapping.get(change_type, "modified")

    def _get_or_create_version(self, resource_path: str, description: str) -> str:
        """Get or create version entry"""
        try:
            existing_response = self.user_supabase.table("versions").select("id").eq(
                "user_id", self.user_id
            ).eq("status", "current").limit(1).execute()
            if existing_response.data:
                return existing_response.data[0]["id"]
            version_data = {
                "version": f"v{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                "title": f"Drive Changes",
                "description": description,
                "user_id": self.user_id,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "current",
                "data": {"resource_path": resource_path, "change_type": description}
            }
            version_response = self.user_supabase.table("versions").insert(version_data).execute()
            return version_response.data[0]["id"]
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

    def _wrap_tool(self, func, operation, track_type=None):
        """Wrap tool functions with permission checks and change tracking"""
        def tool_func(input_str):
            try:
                args = self._parse_tool_input(input_str)
                resource_path = args.get("file_id") or args.get("folder_id") or args.get("source_folder_id") or args.get("name") or ""
                
                if not self._permission_check(operation, resource_path):
                    return json.dumps({"error": f"Permission denied for operation: {operation}"})
                
                result = func(**args)
                
                # Track changes if needed
                if track_type:
                    if operation == "move_file":
                        self._track_change("move", args.get("file_id", ""), old_path=args.get("file_id"), new_path=args.get("new_parent_id"))
                    elif operation == "rename_file":
                        self._track_change("rename", args.get("file_id", ""), old_path=args.get("file_id"), new_path=args.get("new_name"))
                    elif operation == "delete_file":
                        self._track_change("delete", args.get("file_id", ""))
                    elif operation == "create_folder":
                        self._track_change("create", args.get("name", ""))
                    elif operation == "organize_by_type":
                        self._track_change("organize", args.get("source_folder_id", ""))
                
                return json.dumps(result) if isinstance(result, (dict, list)) else str(result)
            except Exception as e:
                logger.error(f"Error in tool {operation}: {e}")
                return json.dumps({"error": str(e)})
        return tool_func

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
            folder_id = args.get("folder_id", "root")
            return organize_drive_by_gemini(self.drive_service.service, folder_id, prompt, self.user_supabase)

        tools = [
            Tool(
                name="ListAllItems",
                func=self._wrap_tool(self.drive_service.list_all_items, "list_all_items"),
                description="Recursively list all files and folders in Google Drive. Input: JSON with 'folder_id' (optional). Returns a flat list of all items."
            ),
            Tool(
                name="ListFiles",
                func=self._wrap_tool(self.drive_service.list_files, "list_files"),
                description="List files in Google Drive. Input: JSON with 'folder_id', 'query', 'max_results'"
            ),
            Tool(
                name="GetFileInfo",
                func=self._wrap_tool(self.drive_service.get_file_info, "get_file_info"),
                description="Get detailed information about a file. Input: JSON with 'file_id'"
            ),
            Tool(
                name="CreateFolder",
                func=self._wrap_tool(self.drive_service.create_folder, "create_folder", track_type=True),
                description="Create a new folder. Input: JSON with 'name' and 'parent_id'"
            ),
            Tool(
                name="MoveFile",
                func=self._wrap_tool(self.drive_service.move_file, "move_file", track_type=True),
                description="Move a file. Input: JSON with 'file_id' and 'new_parent_id'"
            ),
            Tool(
                name="RenameFile",
                func=self._wrap_tool(self.drive_service.rename_file, "rename_file", track_type=True),
                description="Rename a file or folder. Input: JSON with 'file_id' and 'new_name'"
            ),
            Tool(
                name="DeleteFile",
                func=self._wrap_tool(self.drive_service.delete_file, "delete_file", track_type=True),
                description="Delete a file. Input: JSON with 'file_id'"
            ),
            Tool(
                name="GetStorageInfo",
                func=self._wrap_tool(self.drive_service.get_storage_info, "get_storage_info"),
                description="Get Google Drive storage information. Input: empty JSON {}"
            ),
            Tool(
                name="GetFolderStructure",
                func=self._wrap_tool(self.drive_service.get_folder_structure, "get_folder_structure"),
                description="Get folder structure. Input: JSON with 'folder_id' and 'max_depth'"
            ),
            Tool(
                name="DocRetriever",
                func=doc_qa_tool,
                description="Use this tool to answer questions about the documents in the drive. Input: question string"
            ),
            Tool(
                name="GetFileMetadataTable",
                func=lambda _: json.dumps(get_file_metadata_table()),
                description="Fetch all file metadata records from Supabase. Input: empty string. Returns JSON list of file metadata records."
            ),
            Tool(
                name="SuggestFolderStructureWithGemini",
                func=lambda input_str: suggest_folder_structure_with_gemini(input_str if input_str else "Suggest a folder structure for my drive based on my files."),
                description="Suggest a nested folders/files structure for the drive using Gemini. Input: user prompt string. Returns a consistent JSON structure."
            ),
            Tool(
                name="OrganizeDriveByGeminiStructure",
                func=organize_drive_tool,
                description="Organize Google Drive folders according to Gemini's suggested structure. Input: JSON with 'prompt' and 'folder_id' (defaults to 'root'). Only folders/subfolders are changed."
            ),
        ]

        # Create a custom prompt that works better
        from langchain.prompts import PromptTemplate
        template = """You are a helpful Google Drive management assistant. You have access to various tools to help users manage their Google Drive files and folders.

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
            max_iterations=5,
            early_stopping_method="generate",
            return_intermediate_steps=False
        )
        return agent_executor

    def process_message(self, message: str) -> str:
        """Process user message using the modern invoke method"""
        try:
            logger.info(f"Processing user message for user {self.user_id}: {message}")
            # Get chat history as a simple string to avoid format issues
            chat_history = ""
            if hasattr(self.memory, 'chat_memory') and hasattr(self.memory.chat_memory, 'messages'):
                history_messages = self.memory.chat_memory.messages[-10:]  # Last 10 messages
                for msg in history_messages:
                    if hasattr(msg, 'content'):
                        role = "Human" if msg.__class__.__name__ == "HumanMessage" else "Assistant"
                        chat_history += f"{role}: {msg.content}\n"
            # Use the modern invoke method instead of run
            result = self.agent_executor.invoke({
                "input": message,
                "chat_history": chat_history
            })            
            # Extract the output from the result - handle different response formats
            if isinstance(result, dict):
                output = result.get("output", result.get("result", str(result)))
            else:
                output = str(result)            
            # Clean up any JSON formatting that might be in the output
            if isinstance(output, str) and output.startswith('{"response":'):
                try:
                    import json
                    parsed = json.loads(output)
                    output = parsed.get("response", output)
                except:
                    pass            
            return output            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return f"I encountered an error: {str(e)}. Please try again or rephrase your request."

    async def aprocess_message(self, message: str) -> str:
        """Async wrapper for process_message"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.process_message, message)


def create_drive_agent(user_id: str = None, user_supabase_client=None, llm=None) -> GoogleDriveAgent:
    """Factory function to create a GoogleDriveAgent instance"""
    return GoogleDriveAgent(user_id=user_id, user_supabase_client=user_supabase_client, llm=llm)