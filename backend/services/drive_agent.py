from typing import Dict, Any, Optional, Callable
import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool

from config import settings
from backend.scripts.google_drive import GoogleDriveService
from utils.logger import logger


class GoogleDriveAgent:
    def __init__(self, user_id: Optional[str] = None):
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required")
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.drive_service = GoogleDriveService()
        self.model = self._create_model()
        self.chat = None
        self.user_id = user_id or "anonymous"

    def _create_model(self) -> genai.GenerativeModel:
        """Create Gemini model with Google Drive function tools"""
        tools = [Tool(function_declarations=[
            FunctionDeclaration(
                name="list_files",
                description="List files in Google Drive. Can filter by folder or search query.",
                parameters={
                    "type": "object",
                    "properties": {
                        "folder_id": {
                            "type": "string",
                            "description": "Optional Google Drive folder ID to list files from"
                        },
                        "query": {
                            "type": "string",
                            "description": "Optional search query to filter files"
                        },
                        "max_results": {
                            "type": "integer",
                            "description": "Maximum number of results to return (default: 50)"
                        }
                    }
                }
            ),
            FunctionDeclaration(
                name="get_file_info",
                description="Get detailed information about a specific file by its ID",
                parameters={
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "Google Drive file ID"
                        }
                    },
                    "required": ["file_id"]
                }
            ),
            FunctionDeclaration(
                name="create_folder",
                description="Create a new folder in Google Drive",
                parameters={
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Name of the folder to create"
                        },
                        "parent_id": {
                            "type": "string",
                            "description": "Optional parent folder ID"
                        }
                    },
                    "required": ["name"]
                }
            ),
            FunctionDeclaration(
                name="move_file",
                description="Move a file to a different folder",
                parameters={
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file to move"
                        },
                        "new_parent_id": {
                            "type": "string",
                            "description": "ID of the destination folder"
                        }
                    },
                    "required": ["file_id", "new_parent_id"]
                }
            ),
            FunctionDeclaration(
                name="rename_file",
                description="Rename a file or folder",
                parameters={
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file to rename"
                        },
                        "new_name": {
                            "type": "string",
                            "description": "New name for the file"
                        }
                    },
                    "required": ["file_id", "new_name"]
                }
            ),
            FunctionDeclaration(
                name="delete_file",
                description="Delete a file (move to trash). Use with caution!",
                parameters={
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file to delete"
                        }
                    },
                    "required": ["file_id"]
                }
            ),
            FunctionDeclaration(
                name="search_files",
                description="Search for files by name or content",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query"
                        },
                        "max_results": {
                            "type": "integer",
                            "description": "Maximum number of results (default: 50)"
                        }
                    },
                    "required": ["query"]
                }
            ),
            FunctionDeclaration(
                name="get_storage_info",
                description="Get Google Drive storage information",
                parameters={"type": "object", "properties": {}}
            ),
            FunctionDeclaration(
                name="organize_by_type",
                description="Organize files by type within a folder",
                parameters={
                    "type": "object",
                    "properties": {
                        "source_folder_id": {
                            "type": "string",
                            "description": "ID of the folder to organize"
                        }
                    },
                    "required": ["source_folder_id"]
                }
            ),
            FunctionDeclaration(
                name="get_folder_structure",
                description="Get hierarchical folder structure",
                parameters={
                    "type": "object",
                    "properties": {
                        "folder_id": {
                            "type": "string",
                            "description": "Starting folder ID (optional, defaults to root)"
                        },
                        "max_depth": {
                            "type": "integer",
                            "description": "Maximum depth to traverse (default: 3)"
                        }
                    }
                }
            )
        ])]

        generation_config = {
            "temperature": 0.3,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 2048,
        }

        system_instruction = """You are a Google Drive management assistant. You can help users organize, search, and manage their Google Drive files safely.

IMPORTANT SAFETY RULES:
1. Always confirm before deleting files - ask the user to confirm deletion operations
2. When moving or renaming files, explain what you're about to do
3. For bulk operations, process a few files at a time and ask for confirmation
4. If a user asks for destructive operations on many files, ask for explicit confirmation
5. Provide helpful summaries of what was accomplished

You have access to the following Google Drive functions:
- List, search, and get file information
- Create folders and organize files
- Move, rename, and delete files
- Share files with users
- Get storage information
- Organize files by type

Be helpful, safe, and provide clear explanations of what you're doing."""

        return genai.GenerativeModel(
            model_name='gemini-1.5-flash',
            generation_config=generation_config,
            tools=tools,
            system_instruction=system_instruction
        )

    def _get_function_mapping(self) -> Dict[str, Callable]:
        """Map function names to actual drive service methods"""
        return {
            "list_files": self.drive_service.list_files,
            "get_file_info": self.drive_service.get_file_info,
            "create_folder": self.drive_service.create_folder,
            "move_file": self.drive_service.move_file,
            "rename_file": self.drive_service.rename_file,
            "delete_file": self.drive_service.delete_file,
            "search_files": self.drive_service.search_files,
            "get_storage_info": self.drive_service.get_storage_info,
            "organize_by_type": self.drive_service.organize_by_type,
            "get_folder_structure": self.drive_service.get_folder_structure
        }

    def start_chat(self) -> None:
        """Start a new chat session"""
        self.chat = self.model.start_chat()
        logger.info(
            f"Started new Google Drive agent chat session for user {
                self.user_id}")

    def process_message(self, message: str) -> str:
        """Process user message and execute any necessary function calls"""
        if not self.chat:
            self.start_chat()

        try:
            logger.info(
                f"Processing user message for user {
                    self.user_id}: {message}")
            response = self.chat.send_message(message)

            # Handle function calls
            if response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        function_call = part.function_call
                        result = self._execute_function(function_call)

                        # Send function result back to the model
                        function_response = genai.protos.FunctionResponse(
                            name=function_call.name,
                            response={"result": result}
                        )
                        response = self.chat.send_message(function_response)

            return response.text if response.text else "I've completed the requested action."

        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return f"I encountered an error: {str(e)}. Please try again or rephrase your request."

    def _execute_function(self, function_call) -> Any:
        """Execute a Google Drive function safely"""
        function_name = function_call.name
        function_args = dict(function_call.args) if function_call.args else {}

        logger.info(
            f"Executing function: {function_name} with args: {function_args}")

        function_mapping = self._get_function_mapping()

        if function_name not in function_mapping:
            error_msg = f"Unknown function: {function_name}"
            logger.error(error_msg)
            return {"error": error_msg}

        try:
            # Execute the function
            func = function_mapping[function_name]
            result = func(**function_args)

            logger.info(f"Function {function_name} executed successfully")
            return result

        except Exception as e:
            error_msg = f"Error executing {function_name}: {str(e)}"
            logger.error(error_msg)
            return {"error": error_msg}

    def reset_chat(self) -> None:
        """Reset the chat session"""
        self.chat = None
        logger.info("Reset Google Drive agent chat session")


def create_drive_agent() -> GoogleDriveAgent:
    """Factory function to create a Google Drive agent"""
    return GoogleDriveAgent()
