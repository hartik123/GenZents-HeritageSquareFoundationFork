from typing import Dict, Any, Optional, Callable
from datetime import datetime
import uuid
from langchain.agents import initialize_agent, AgentType
from langchain.tools import Tool
from langchain.memory import ConversationBufferMemory
from config import settings
from scripts.google_drive import GoogleDriveService
from utils.logger import logger

from utils.user_security import get_security_service
from storage.database import get_user_supabase_client
from scripts.chroma import search_documents
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
        self.llm = llm
        self.memory = ConversationBufferMemory(memory_key=f"chat_history_{self.user_id}", return_messages=True)
        self.agent = self._create_agent()

    def _permission_check(self, operation: str, resource_path: str = "") -> bool:
        if not self.user_supabase or not self.user_id:
            return False
        try:
            # Fetch user profile from Supabase
            profile_resp = self.user_supabase.table("profiles").select("permission").eq("id", self.user_id).limit(1).execute()
            if not profile_resp.data or not profile_resp.data[0].get("permission"):
                return False
            permission = profile_resp.data[0]["permission"]
            # Define which operations require write
            write_ops = {"create_folder", "move_file", "rename_file", "delete_file", "organize_by_type"}
            if operation in write_ops:
                return permission == "write"
            # All other operations allowed for read or write
            return permission in ("read", "write")
        except Exception as e:
            logger.error(f"Error checking permissions for user {self.user_id}: {e}")
            return False

    def _track_change(self, change_type: str, resource_path: str, old_path: str = None, new_path: str = None, metadata: Dict[str, Any] = None) -> None:
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

    def _wrap_tool(self, func, operation, track_type=None):
        def tool_func(input_str):
            try:
                args = eval(input_str) if isinstance(input_str, str) and input_str.strip().startswith('{') else {}
                resource_path = args.get("file_id") or args.get("folder_id") or args.get("source_folder_id") or args.get("name") or ""
                if not self._permission_check(operation, resource_path):
                    return {"error": f"Permission denied for operation: {operation}"}
                result = func(**args)
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
                return result
            except Exception as e:
                logger.error(f"Error in tool {operation}: {e}")
                return {"error": str(e)}
        return tool_func

    def _create_agent(self):
        tools = [
            Tool(
                name="ListFiles",
                func=self._wrap_tool(self.drive_service.list_files, "list_files"),
                description="List files in Google Drive. Input: {'folder_id': str, 'query': str, 'max_results': int}"
            ),
            Tool(
                name="GetFileInfo",
                func=self._wrap_tool(self.drive_service.get_file_info, "get_file_info"),
                description="Get detailed information about a file. Input: {'file_id': str}"
            ),
            Tool(
                name="CreateFolder",
                func=self._wrap_tool(self.drive_service.create_folder, "create_folder", track_type=True),
                description="Create a new folder. Input: {'name': str, 'parent_id': str}"
            ),
            Tool(
                name="MoveFile",
                func=self._wrap_tool(self.drive_service.move_file, "move_file", track_type=True),
                description="Move a file. Input: {'file_id': str, 'new_parent_id': str}"
            ),
            Tool(
                name="RenameFile",
                func=self._wrap_tool(self.drive_service.rename_file, "rename_file", track_type=True),
                description="Rename a file or folder. Input: {'file_id': str, 'new_name': str}"
            ),
            Tool(
                name="DeleteFile",
                func=self._wrap_tool(self.drive_service.delete_file, "delete_file", track_type=True),
                description="Delete a file. Input: {'file_id': str}"
            ),
            Tool(
                name="GetStorageInfo",
                func=self._wrap_tool(self.drive_service.get_storage_info, "get_storage_info"),
                description="Get Google Drive storage information. Input: {}"
            ),
            Tool(
                name="GetFolderStructure",
                func=self._wrap_tool(self.drive_service.get_folder_structure, "get_folder_structure"),
                description="Get folder structure. Input: {'folder_id': str, 'max_depth': int}"
            ),
            Tool(
                name="SearchDriveDocuments",
                func=lambda input_str: search_documents(input_str),
                description="Semantic search over embedded Google Drive documents. Input: query string. Returns top relevant document chunks."
            ),
            Tool(
                name="GetFileMetadataTable",
                func=lambda _: get_file_metadata_table(),
                description="Fetch all file metadata records from Supabase. Input: {}. Returns a list of file metadata records."
            ),
            Tool(
                name="SuggestFolderStructureWithGemini",
                func=lambda input_str: suggest_folder_structure_with_gemini(input_str if input_str else "Suggest a folder structure for my drive based on my files."),
                description="Suggest a nested folders/files structure for the drive using Gemini, file metadata, and ChromaDB as a knowledge base. Input: user prompt string. Returns a consistent JSON structure."
            ),
            Tool(
                name="OrganizeDriveByGeminiStructure",
                func=lambda input_str, folder_id: organize_drive_by_gemini(self.drive_service.service, folder_id, input_str, self.user_supabase),
                description="Organize Google Drive folders according to Gemini's suggested structure. Input: user prompt string, folder ID which needs to be organized. Only folders/subfolders are changed."
            ),
        ]
        return initialize_agent(
            tools,
            self.llm,
            agent=AgentType.CONVERSATIONAL_REACT_DESCRIPTION,
            memory=self.memory,
            verbose=True,
            handle_parsing_errors=True
        )

    def process_message(self, message: str) -> str:
        try:
            logger.info(f"Processing user message for user {self.user_id}: {message}")
            response = self.agent.run(message)
            return response
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return f"I encountered an error: {str(e)}. Please try again or rephrase your request."


def create_drive_agent(user_id: str = None, user_supabase_client=None, llm=None) -> GoogleDriveAgent:
    if llm is None:
        from .generative_ai import GENAI_MODEL
        llm = GENAI_MODEL
    return GoogleDriveAgent(user_id=user_id, user_supabase_client=user_supabase_client, llm=llm)