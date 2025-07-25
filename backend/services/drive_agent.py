from typing import Dict, Any, Optional, Callable
import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool
from datetime import datetime
import uuid

from config import settings
from scripts.google_drive import GoogleDriveService
from utils.logger import logger
from services.user_security import get_security_service
from storage.database import get_user_supabase_client
import os
from supabase import create_client, Client


class GoogleDriveAgent:
    def __init__(self, user_id: Optional[str]
                 = None, user_supabase_client=None):
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required")
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.drive = GoogleDriveService()
        self.model = self._create_model()
        self.chat = None
        self.user_id = user_id or "anonymous"
        # self.user_supabase = user_supabase_client
        self.security_service = get_security_service(user_supabase_client) if user_supabase_client else None
        
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_ANON_KEY")
        supabase: Client = create_client(url, key)
        self.user_supabase = supabase

    def _create_model(self) -> genai.GenerativeModel:
        """Create Gemini model with Google Drive function tools"""
        tools = [Tool(function_declarations=[
            FunctionDeclaration(
                name="organize_file",
                description="Analyze file content and automatically suggest/move it to the most appropriate folder based on content similarity and folder topics. Uses AI to understand file content and match it with existing folder categories.",
                    parameters={
                        "type": "object",
                        "properties": {
                            "file_name": {
                                "type": "string",
                                "description": "Name of the file to organize"
                            },
                            "auto_move": {
                                "type": "boolean",
                                "description": "Whether to automatically move the file to the suggested folder (default: false)"
                            }
                        },
                        "required": ["file_name"]
                    }
            ),
            FunctionDeclaration(
                name="list_files",
                description="List files in Google Drive. Can filter by folder or search query.",
                parameters={
                    "type": "object",
                    "properties": {
                        "folder_names": {
                            "type": "array",
                            "items":{
                                "type":"string"
                            },
                            "description": "Optional Google Drive folder name to list files from",
                        },
                        "query": {
                            "type": "string",
                            "description": "Optional search query to filter files"
                        },
                        "max_results": {
                            "type": "integer",
                            "description": "Maximum number of results to return (default: 50)",
                        }
                    },
                    "required":[],
                } 
            ),
            FunctionDeclaration(
                name="get_file_info",
                description="Get detailed information about a specific file by its ID",
                parameters={
                    "type": "object",
                    "properties": {
                        "filename": {
                            "type": "string",
                            "description": "Google Drive file ID"
                        }
                    },
                    "required": ["filename"]
                }
            ),
            FunctionDeclaration(
                name="move_file_by_foldername",
                description="Move file given a folder name",
                parameters={
                    "type": "object",
                    "properties": {
                        "filename": {
                            "type": "string",
                            "description": "Google Drive file ID"
                        },
                        "foldername":{
                            "type": "string",
                            "description": "Google Drive file ID"
                        }
                    },
                    "required": ["filename", "foldername"]
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
            # FunctionDeclaration(
            #     name="move_file",
            #     description="Move a file to a different folder",
            #     parameters={
            #         "type": "object",
            #         "properties": {
            #             "file_id": {
            #                 "type": "string",
            #                 "description": "ID of the file to move"
            #             },
            #             "new_parent_id": {
            #                 "type": "string",
            #                 "description": "ID of the destination folder"
            #             }
            #         },
            #         "required": ["file_id", "new_parent_id"]
            #     }
            # ),
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
                        },
                        "file_name": {
                            "type": "string",
                            "description": "Name of the file"
                        },
                        
                    },
                    "required": ["new_name", "file_name"]
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
            ),
            FunctionDeclaration(
                name="handle_regular_query",
                description="Return response for user's query about the content in the google drive. This function is called when there is no other functions matches the query of user",
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "User query about the content in Google Drive"
                        }
                    },
                    "required": ["query"]
                }
            ),
        ])]

        generation_config = {
            "temperature": 0.3,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 2048,
        }

        system_instruction = """Your goal is to:
1. Understand the user's intent
2. If the intent matches a specific file operation (like organize, move, rename, list, etc.), use the appropriate function
3. For any other queries about file contents or general questions, use the handle_regular_query function to search the vector store

IMPORTANT: For any query that doesn't explicitly match a file operation function, ALWAYS use handle_regular_query to provide relevant information from the document contents.
        {
        "function_name": "<function_name>",
        "args": {
            "<parameter1>": "<value>",
            "<parameter2>": "<value>",
            ...
        }
        }

        Only return a dictionary like this when the user's intent clearly matches a defined function. If not, respond conversationally or ask clarifying questions.

        ---
        Available Functions:

        1. **list_files**
        - folder_names (optional, list of string): Google Drive folder name to list files from. Folder names are optional
        - query (optional, string): Search query to filter files.
        - max_results (optional, integer): Max number of results to return.

        2. **get_file_info**
        - filename (required, string): Google Drive file name.

        3. **create_folder**
        - name (required, string): Name of the folder to create.
        - parent_id (optional, string): Parent folder ID.

        4. **move_file**
        - file_id (required, string): ID of the file to move.
        - new_parent_id (required, string): ID of the destination folder.

        5. **rename_file**
        - file_name (required, string): name of the file or folder to rename.
        - new_name (required, string): New name.

        6. **delete_file**
        - file_id (required, string): ID of the file to delete.

        7. **search_files**
        - query (required, string): Search query.
        - max_results (optional, integer): Max number of results to return.

        8. **get_storage_info**
        - No parameters.

        9. **get_folder_structure**
        - folder_id (optional, string): Starting folder ID (defaults to root).
        - max_depth (optional, integer): Max depth to traverse.

        9. **handle_regular_query**
        - query (str): User query about content in google drive. This function is matched when there is no functions in the funtions map matches the query of the user
        
        10. **move_file_by_foldername**
        - filename ( string): File name that the user want to move.
        - foldername ( integer): Folder name that user want to move the file to.
        ---
        
        """

        return genai.GenerativeModel(
            model_name='gemini-1.5-flash',
            generation_config=generation_config,
            tools=tools,
            system_instruction=system_instruction
        )
        

    def _get_function_mapping(self) -> Dict[str, Callable]:
        """Map function names to actual drive service methods"""
        return {
            "handle_regular_query":self.handle_regular_query,
            "organize_file":self.organize_handler,
            "list_files": self.list_files_text,
            "get_file_info": self.drive.get_file_info,
            "create_folder": self.drive.create_folder,
            "move_file_by_foldername": self.move_file_by_foldername,
            "rename_file": self.drive.rename_file,
            "delete_file": self.drive.delete_file,
            "search_files": self.drive.search_files,
            "get_storage_info": self.drive.get_storage_info,
            "get_folder_structure": self.drive.get_folder_structure
        }

    def start_chat(self) -> None:
        """Start a new chat session"""
        self.chat = self.model.start_chat()
        logger.info(
            f"""Started new Google Drive agent chat session for user {self.user_id}""")

    def process_message(self, message: str) -> str:
        """Process user message and execute any necessary function calls"""
        if not self.chat:
            self.start_chat()

        try:
            logger.info(
                f"""Processing user message for user {self.user_id}: {message}""")
            response = self.chat.send_message(message)
            logger.info(f"Received response: {response}")
            function_response = []
            # Handle function calls
            if response.candidates[0].content.parts:
                function_calls = [
                    part.function_call
                    for part in response.candidates[0].content.parts
                    if hasattr(part, 'function_call') and part.function_call
                ]
                print("FUNCTION CALL:", function_calls)
                for function_call in function_calls:
                    result = self._safe_execute_function(function_call)
                    print("RESULT FROM FUNCTION CALL ", result)

                    function_response.append(genai.protos.FunctionResponse(
                        name=function_call.name,
                        response={"result": result}
                    ))
                    print("done function call")
                # if function_response:   
                #     response = self.chat.send_message(function_response)
                print(len(function_response) , len(function_calls))
                formatted_responses = [
                    {
                        "function_response": response
                    } for response in function_response
                ]
                response = self.chat.send_message(f"Give response to the user query: {message} after calling functions and got response {formatted_responses}")
            return response.text if response.text else "I've completed the requested action."

        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return f"I encountered an error: {str(e)}. Please try again or rephrase your request."

    def move_file_by_foldername(self,filename:str, foldername:str):
        return self.drive.move_file_by_folder_name(file_name=filename, destination_folder_name=foldername)
    
    
    async def _check_user_permissions(
            self, operation: str, resource_path: str = "") -> bool:
        """Check if user has permission to perform the operation"""
        if not self.security_service or not self.user_id:
            return False

        try:
            # Get user constraints to check permissions
            constraints = await self.security_service.get_user_constraints(self.user_id)

            # Permission mapping for different operations
            permission_map = {
                "list_files": "read",
                "get_file_info": "read",
                "create_folder": "write",
                "move_file": "write",
                "rename_file": "write",
                "delete_file": "write",
                "search_files": "read",
                "get_folder_structure": "read"
            }

            required_permission = permission_map.get(
                operation, "write")

            # Admin can do everything
            if constraints.is_admin:
                return True

            # Check if user has required permission
            return required_permission in constraints.permissions

        except Exception as e:
            logger.error(
                f"""Error checking permissions for user {self.user_id}: {e}""")
            return False

    def list_files_text(self, folder_names: Optional[list[str]]=None):
        files = self.drive.list_all_file_metadata(folder_names)
        text = ""
        for file in files:
            text+= f"{file['name']} \n"
        return text
            
        
    async def _track_change(self, change_type: str, resource_path: str,
                            old_path: str = None, new_path: str = None,
                            metadata: Dict[str, Any] = None) -> None:
        """Track file/folder changes using existing changes table structure only"""
        if not self.user_supabase or not self.user_id:
            return

        try:
            # First create or get version entry
            version_id = await self._get_or_create_version(resource_path, f"{change_type.title()} operation")

            # Insert using only the existing table structure from database.ts
            change_data = {
                "version_id": version_id,
                "type": self._map_change_type(change_type),
                "original_path": old_path or resource_path,
                "new_path": new_path,
                "description": f"{change_type} operation on {resource_path}",
                "user_id": self.user_id,
                "timestamp": datetime.utcnow().isoformat()
            }

            result = self.user_supabase.table(
                "changes").insert(change_data).execute()
            logger.info(f"Tracked change: {change_type} on {resource_path}")

        except Exception as e:
            logger.error(f"Error tracking change: {e}")

    def _map_change_type(self, change_type: str) -> str:
        """Map our change types to existing table's type values from database.ts"""
        mapping = {
            "create": "added",
            "update": "modified",
            "delete": "deleted",
            "move": "modified",
            "rename": "modified",
            "organize": "modified"
        }
        return mapping.get(change_type, "modified")

    async def _get_or_create_version(
            self, resource_path: str, description: str) -> str:
        """Get existing version or create new one using existing table structure from database.ts"""
        try:
            # Check for existing current version for this user
            existing_response = self.user_supabase.table("versions").select("id").eq(
                "user_id", self.user_id
            ).eq("status", "current").limit(1).execute()

            if existing_response.data:
                return existing_response.data[0]["id"]

            # Create new version using only existing structure from database.ts
            version_data = {
                "version": f"v{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                "title": f"Drive Changes",
                "description": description,
                "user_id": self.user_id,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "current",
                "data": {"resource_path": resource_path, "change_type": description}
            }

            version_response = self.user_supabase.table(
                "versions").insert(version_data).execute()
            return version_response.data[0]["id"]

        except Exception as e:
            logger.error(f"Error creating version entry: {e}")
            # Return a placeholder if version creation fails
            return str(uuid.uuid4())

    def _safe_execute_function(self, function_call) -> Any:
        """Execute a Google Drive function with permission checking and change tracking"""
        function_name = function_call.name
        function_args = dict(function_call.args) if function_call.args else {}
        print("function_name ",function_name,  "function_args ", function_args)
        # Check permissions first
        resource_path = function_args.get(
            "file_id", function_args.get(
                "folder_id", ""))
        has_permission = True

        if not has_permission:
            error_msg = f"Permission denied for operation: {function_name}"
            logger.warning(
                f"""User {self.user_id} denied permission for {function_name}""")
            return {"error": error_msg}

        # Execute the original function
        try:
            function_mapping = self._get_function_mapping()
            func = function_mapping[function_name]
            result = func(**function_args)

            # Track changes for modification operations
            # if function_name in ["move_file", "rename_file",
            #                      "delete_file", "create_folder"]:
            #     await self._track_file_operation(function_name, function_args, result)
            return result

        except Exception as e:
            error_msg = f"Error executing {function_name}: {str(e)}"
            logger.error(error_msg)
            return {"error": error_msg}

    async def _track_file_operation(
            self, operation: str, args: Dict[str, Any], result: Any) -> None:
        """Track specific file operations using existing table structure"""
        try:
            if operation == "move_file":
                await self._track_change("move", args.get("file_id", ""),
                                         old_path=args.get("file_id"),
                                         new_path=args.get("new_parent_id"))

            elif operation == "rename_file":
                await self._track_change("rename", args.get("file_id", ""),
                                         old_path=args.get("file_id"),
                                         new_path=args.get("new_name"))

            elif operation == "delete_file":
                await self._track_change("delete", args.get("file_id", ""))

            elif operation == "create_folder":
                await self._track_change("create", args.get("name", ""))

        except Exception as e:
            logger.error(f"Error tracking file operation {operation}: {e}")

    def reset_chat(self) -> None:
        """Reset the chat session"""
        self.chat = None
        logger.info("Reset Google Drive agent chat session")
    
    
    def store_all_folders(self) -> None:
        """
        List all folders in Drive, process their contents, and store summaries in Supabase
        """
        
        try:
            # Query to get only folders
            folder_query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
            folders = self.drive.service.files().list(
                q=folder_query,
                fields="files(id, name, mimeType)",
                pageSize=1000
            ).execute().get('files', [])

            logger.info(f"Found {len(folders)} folders to process")

            for folder in folders:
                logger.info(f"processing folder: {folder['name']}")
                try:
                    folder_id = folder['id']
                    folder_name = folder['name']
                    
                    # Get all files in this folder
                    files_query = f"'{folder_id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
                    files = self.drive.service.files().list(
                        q=files_query,
                        fields="files(id, name, mimeType)",
                        pageSize=10
                    ).execute().get('files', [])
                    
                    # Collect content from all files in the folder
                    folder_content = []
                    for file in files:
                        try:
                            content = self.drive.download_and_get_file_content(
                                file['id'], 
                                file['mimeType']
                            )
                            if content:
                                folder_content.append(f"File: {file['name']}\n{content[:1000]}") # Limit content size
                        except Exception as e:
                            logger.error(f"Error processing file {file['name']}: {e}")
                            continue

                    # If folder has content, summarize it
                    if folder_content:
                        # Create summarization prompt
                        combined_content = "\n\n---\n\n".join(folder_content)
                        prompt = f"""Please analyze the following folder contents and provide:
                        1. A brief summary (2-3 sentences)
                        2. Main topics or themes (up to 5 key points)
                        3. Purpose or context of these documents

                        Folder name: {folder_name}
                        Contents:
                        {combined_content[:5000]}  # Limit total content
                        """

                        # Get model response
                        if not self.chat:
                            self.start_chat()
                        
                        response = self.chat.send_message(prompt)
                        summary = response.text if response.text else "No summary available"

                        # Store in Supabase
                        folder_data = {
                            "id": folder_id,
                            "name": folder_name,
                            "topics": summary
                            # "file_count": len(files),
                            # "last_updated": datetime.utcnow().isoformat()
                        }

                        result = self.user_supabase.table("Ohack folder topics").upsert(folder_data).execute()

                        logger.info(f"Stored summary for folder: {folder_name}")

                except Exception as e:
                    logger.error(f"Error processing folder {folder_name}: {e}")
                    continue

        except Exception as e:
            logger.error(f"Failed to process folders: {e}")
            raise

    def organize_handler(self, file_name):
        try:
            # Search for file in Drive
            logger.info(f"get into organize handler {file_name}" )
            result = self.drive.search_files(query=file_name, max_results=1)
            if not result:
                raise ValueError(f"File not found: {file_name}")
            file = result[0]
            file_id = result[0]['id']
            # file_info = self.drive.get_file_info(file_id)
            old_folder_id = file.get('parents', [])[0] if file.get('parents') else None
            logger.info(f'old_folder_id :{old_folder_id}')
            # Get file content
            content = self.drive.download_and_get_file_content(
                file_id=file_id,
                file_mimeType=file['mimeType']
            )
            
            if not content:
                raise ValueError(f"Could not extract content from file: {file_name}")
                
            # Get folder topics from Supabase
            folder_topics = self.user_supabase.table("Ohack folder topics").select("*").execute()
            if not folder_topics.data:
                raise ValueError("No folder topics found in database")
                
            # Create classification prompt
            folders_context = "\n\n".join([
                f"Folder: {folder['name']} \n Folder ID: {folder['id']}\nTopics: {folder['topics']}"
                for folder in folder_topics.data
            ])
            print(f'FOLDERS CONTEXT : {folders_context}')
            prompt = f"""Based on the following folder descriptions and the content of the file, 
            determine the most appropriate folder to store the file in.
            
            File name: {file_name}
            File content (preview):
            {content[:2000]}...
            
            Available folders and their topics:
            {folders_context}
            
            Return ONLY the folder ID that best matches the file content, or 'none' if no folder is appropriate.
            Explain your reasoning in one sentence.
            Format: <file_name>|<new_folder_name>|<new_folder_id>|<reason>
            """
            
            # Get model's suggestion
            if not self.chat:
                self.start_chat()
            
            response = self.chat.send_message(prompt)
            if not response.text:
                raise ValueError("Failed to get folder suggestion from model")
                
            # Parse response
            filename, folder_name, folder_id, reason = response.text.split("|")
            folder_id = folder_id.strip()
            
            if folder_id.lower() == "none":
                raise ValueError(f"No suitable folder found: {reason}")
                
            # Get folder details
            matching_folder = next(
                (f for f in folder_topics.data if f['id'] == folder_id),
                None
            )
            
            if not matching_folder:
                raise ValueError(f"Suggested folder ID not found: {folder_id}")
            
            result = self.drive.move_file(file_id=file_id, new_parent_id=folder_id, old_parent_id=old_folder_id)
            return {
                "filename": file_name,
                "file_id": file_id,
                "new_folder_id": folder_id,
                "new_folder_name": folder_name,
                "old_folder_id": old_folder_id,
                "reason": reason.strip()
            }
            
            
        except Exception as e:
            logger.error(f"Error organizing file {file_name}: {str(e)}")
            raise
    
    def handle_regular_query(self, query:str):
        try:
            logger.info(f"Processing query for user {self.user_id}")

            from services.rag import RAG
            my_rag = RAG(self.drive)
            logger.info("done initializing rag")
            context = my_rag.retrieve(query)
            # message = my_rag.generate_message(context=context,query=query)
            # print(message)
            
            prompt = f"""Question: {query}

                Retrieved Context:
                {context}

                Please provide a clear, relevant answer based on the above context."""

            if not self.chat:
                self.start_chat()

            response = self.chat.send_message(prompt)
            return response.text if response.text else "No relevant information found."

        except Exception as e:
            logger.error(f"Error in process_regular_query: {str(e)}")
            raise ValueError(f"Query processing failed: {str(e)}")
            
def create_drive_agent(user_id: str = None,
                       user_supabase_client=None) -> GoogleDriveAgent:
    """Factory function to create a Google Drive agent with user context"""
    return GoogleDriveAgent(
        user_id=user_id, user_supabase_client=user_supabase_client)
