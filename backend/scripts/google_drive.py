import os
import io
import json
from typing import Dict, List, Optional, Any
import PyPDF2
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2 import service_account
# from config import settings
import logging
import sys
from datetime import datetime
from typing import Optional


class Logger:
    _instance: Optional['Logger'] = None
    _logger: Optional[logging.Logger] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._logger is None:
            self._setup_logger()

    def _setup_logger(self):
        self._logger = logging.getLogger("archyx_ai_backend")
        self._logger.setLevel(logging.INFO)

        if not self._logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self._logger.addHandler(handler)

    def info(self, message: str, **kwargs):
        self._logger.info(message, **kwargs)

    def error(self, message: str, **kwargs):
        self._logger.error(message, **kwargs)

    def warning(self, message: str, **kwargs):
        self._logger.warning(message, **kwargs)

    def debug(self, message: str, **kwargs):
        self._logger.debug(message, **kwargs)


logger = Logger()


class GoogleDriveService:
    SCOPES = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.metadata'
    ]

    def __init__(self, credentials_path: Optional[str] = None):
        self.credentials_path = credentials_path or "credentials.json"  # Update with your credentials path
        self.service = None
        self._authenticate()

    def _authenticate(self) -> None:
        """Authenticate with Google Drive API using service account"""
        if not os.path.exists(self.credentials_path):
            raise FileNotFoundError(
                f"Credentials file not found: {self.credentials_path}")
        try:
            # Load and validate the service account credentials
            with open(self.credentials_path, 'r') as f:
                creds_info = json.load(f)
            # Verify it's a service account credentials file
            if creds_info.get('type') != 'service_account':
                raise ValueError(
                    f"""Invalid credentials type. Expected 'service_account', got '{
                        creds_info.get('type')}'. """
                    "Please use a service account credentials file for backend applications."
                )
            logger.info("Using service account authentication")
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path, scopes=self.SCOPES)
            self.service = build('drive', 'v3', credentials=credentials)
            logger.info("Google Drive service initialized successfully")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in credentials file: {e}")
        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            raise RuntimeError(
                f"Failed to authenticate with Google Drive API: {e}")

    def get_default_folder_id(self) -> str:
        """Get the default folder ID for service account operations (shared with the service account)"""
        try:
            # For service accounts, we should use the first accessible shared folder
            # instead of 'root' which may not be accessible
            results = self.service.files().list(
                pageSize=1,
                q="mimeType='application/vnd.google-apps.folder' and sharedWithMe=true",
                fields="files(id, name)",
                orderBy="name"
            ).execute()
            
            folders = results.get('files', [])
            if folders:
                default_folder_id = folders[0]['id']
                logger.info(f"Using shared folder as default: {folders[0]['name']} (ID: {default_folder_id})")
                return default_folder_id
            else:
                # Fallback to accessible files if no shared folders found
                results = self.service.files().list(
                    pageSize=1,
                    fields="files(id, name)",
                    orderBy="name"
                ).execute()
                files = results.get('files', [])
                if files:
                    # Use the parent of the first accessible file
                    file_info = self.service.files().get(fileId=files[0]['id'], fields="parents").execute()
                    parents = file_info.get('parents', [])
                    if parents:
                        logger.info(f"Using parent folder of first accessible file as default: {parents[0]}")
                        return parents[0]
                
                # Ultimate fallback to 'root' but log a warning
                logger.warning("No shared folders found, falling back to 'root' - this may cause permission issues")
                return 'root'
                
        except Exception as e:
            logger.error(f"Error getting default folder: {e}")
            logger.warning("Falling back to 'root' folder")
            return 'root'

    def get_file_info(self, file_id: Optional[str]=None, file_name:Optional[str]=None,
                     max_results: int = 50) -> List[Dict[str, Any]]:
        """Search for files by name or file id"""
        file = None
        try:
            # Treat empty dicts, empty strings, and None as no file_id/file_name provided
            invalid_id = file_id is None or file_id == '' or file_id == {} or (isinstance(file_id, dict) and not file_id)
            invalid_name = file_name is None or file_name == '' or file_name == {} or (isinstance(file_name, dict) and not file_name)
            if invalid_id and invalid_name:
                default_folder_id = self.get_default_folder_id()
                file = self.service.files().get(
                    fileId=default_folder_id,
                    fields="id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, owners",
                    supportsAllDrives=True
                ).execute()
                return self._format_file_info(file)
            if invalid_id:
                logger.info("searching for file")
                search_query = f"name contains '{file_name}' or fullText contains '{file_name}'"
                results = self.service.files().list(
                    q=search_query,
                    pageSize=max_results,
                    fields="files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, owners)",
                    orderBy="modifiedTime desc",
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True 
                ).execute()
                files = results.get("files",[])
                if not files: 
                    return None
                file=files[0]
                return self._format_file_info(file)
            else:
                file = self.service.files().get(
                    fileId=file_id,
                    fields="id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, owners",
                    supportsAllDrives=True
                ).execute()
                return self._format_file_info(file)
            logger.info(f"File: {file.get('name')} - Parents: {file.get('parents', 'NO PARENTS')}")
        except HttpError as e:
            logger.error(f"Failed to search files with query '{file_name}': {e}")
            raise

    def list_files_in_folder(self, folder_id:Optional[str]=None, folder_name: Optional[str]=None):
        try:
            results = None
            if not folder_id and not folder_name:
                # if folder_id not provided, list all files and folders in the google drive
                results = self.service.files().list(
                    pageSize=10,
                    fields="nextPageToken, files(id, name, parents, mimeType, createdTime, modifiedTime, owners)"
                ).execute()                
            elif folder_id:
                query = f"'{folder_id}' in parents and trashed=false"
                results = self.service.files().list(
                    q=query,
                    fields="nextPageToken, files(id, name, parents, mimeType, createdTime, modifiedTime, owners)"
                ).execute()
            elif folder_name:
                folder_query = " or ".join([f"name = '{name}' and mimeType = 'application/vnd.google-apps.folder'"
                    for name in folder_name
                ])
                results = self.service.files().list(
                    q=folder_query,
                    fields="nextPageToken, files(id, name, parents, mimeType, createdTime, modifiedTime, owners)",
                    pageSize=10
                ).execute()
            items = results.get('files', [])
            return items
        except Exception as e:
            logger.error(f"Can't list all files: {str(e)}")
            
    def search_folder_by_name(self, folder_name: str, exact_match: bool = False, max_results: int = 10) -> List[Dict[str, Any]]:
        try:
            logger.info(f"Searching for folders with name: {folder_name}")
            # Build the search query
            if exact_match:
                search_query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            else:
                search_query = f"name contains '{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            # Execute the search
            results = self.service.files().list(
                q=search_query,
                pageSize=max_results,
                fields="files(id, name, parents, mimeType, createdTime, modifiedTime, owners, webViewLink)",
                orderBy="name",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True
            ).execute()
            folders = results.get('files', [])
            if not folders:
                logger.info(f"No folders found matching: {folder_name}")
                return []
            folder=folders[0]
            logger.info(f"Found {len(folders)} folders matching: {folder_name}")
            # Format and return the folder information
            return self._format_file_info(folder)
        except HttpError as e:
            logger.error(f"HTTP error searching for folders: {e}")
            raise
        except Exception as e:
            logger.error(f"Error searching for folders: {e}")
            raise

    def list_files_recursively(self, folder_id: Optional[str] = None) -> list:
        """Recursively list all files and folders starting from folder_id (None = all accessible files/folders)."""
        items = self.list_files_in_folder(folder_id)
        all_items = []
        for item in items:
            all_items.append(item)
            if item['mimeType'] == 'application/vnd.google-apps.folder':
                all_items.extend(self.list_files_in_folder(item['id']))
        return all_items

    def create_folder(
            self, folder_name: str, parent_ids: Optional[List[str]] = None, parent_names: Optional[List[str]]=None) -> Dict[str, Any]:
        """Create a new folder"""
        try:
            if not parent_ids:
                parent_ids = []
                if parent_names:
                    for parent in parent_names:
                        parent_id = self.search_folder_by_name(parent)
                        if parent_id:
                            parent_ids.append(parent_id)
            folder_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            if parent_ids:
                folder_metadata['parents'] = parent_ids
            folder = self.service.files().create(
                body=folder_metadata,
                fields='id,name,parents,webViewLink,createdTime'
            ).execute()
            logger.info(f"FOLDER RETURNS: {folder}")
            permission = {
                'type': 'user',
                'role': 'writer',  
                'emailAddress': 'drive-api-sa@kinetic-object-467721-p4.iam.gserviceaccount.com',
            }
            self.service.permissions().create(
                fileId=folder['id'],
                body=permission,
                sendNotificationEmail=True).execute()
            logger.info(f"Created folder: {folder_name} (ID: {folder['id']})")
            return self._format_file_info(folder)
        except HttpError as e:
            logger.error(f"Failed to create folder {folder_name}: {e}")
            raise

    def download_and_get_file_content(self, file_id: str, file_mimeType: str) -> bytes:
        export_mime_map = {
            "application/vnd.google-apps.document": "text/plain",
            "application/vnd.google-apps.spreadsheet": "text/csv",
            "application/vnd.google-apps.presentation": "text/plain"
        }
        if file_mimeType.startswith("application/vnd.google-apps"):
            export_mime = export_mime_map[file_mimeType]
            if file_mimeType not in export_mime_map:
                logger.warning(f"Unsupported Google type: {export_mime}")
                return None
            request = self.service.files().export(fileId=file_id, mimeType=export_mime)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()
            fh.seek(0)
            content = fh.read().decode('utf-8', errors="ignore")
            logger.info(
                f"Downloaded file (ID: {file_id}), size: {len(content)} bytes")
            return content
        # process other file types
        else:
            request = self.service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()
            fh.seek(0)
            if "pdf" in file_mimeType:
                reader = PyPDF2.PdfReader(fh)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() or ""
            if "csv" in file_mimeType:
                csv_text = fh.read().decode('utf-8', errors='ignore')
                return csv_text
            if "text" in file_mimeType:
                text = fh.read().decode('utf-8', errors='ignore')
                return text    
    
    def delete_file(self, file_id: str) -> bool:
        """Delete a file (move to trash)"""
        try:
            self.service.files().delete(fileId=file_id).execute()
            logger.info(f"Deleted file (ID: {file_id})")
            return True
        except HttpError as e:
            logger.error(f"Failed to delete file {file_id}: {e}")
            return False

    def move_file(self, new_parent_id: str, file_id: Optional[str]=None, file_name:Optional[str]=None,
                  old_parent_id: Optional[str]=None, ) -> Dict[str, Any]:
        """Move a file to a different folder"""
        try:
            if not file_id and not file_name:
                return []            
            if not file_id:
                file = self.get_file_info(file_name=file_name)
                if not file:
                    return []
                file_id = file.get('id')
            if not old_parent_id:
                file_info = self.service.files().get(
                    fileId=file_id,
                    fields='parents',
                    supportsAllDrives=True,
                ).execute()
                old_parent_id = file_info.get('parents', [None])[0]
            file = self.service.files().update(
                fileId=file_id,
                addParents=new_parent_id,
                removeParents=old_parent_id,
                fields='id,name,parents',
                supportsAllDrives=True,
            ).execute()
            logger.info(
                f"Moved file (ID: {file_id}) to folder (ID: {new_parent_id})")
            return self._format_file_info(file)
        except HttpError as e:
            logger.error(f"Failed to move file {file_id}: {e}")
            raise

    def rename_file(self,new_name: str, file_id: Optional[str]=None, file_name:Optional[str]=None) -> Dict[str, Any]:
        """Rename a file"""
        try:
            if not file_id and not file_name:
                return None
            if not file_id:
                file= self.get_file_info(file_name=file_name)
                if not file:
                    return None
                file_id = file['id']                
            file = self.service.files().update(
                fileId=file_id,
                body={'name': new_name},
                fields='id,name,modifiedTime',
                supportsAllDrives=True,
            ).execute()
            return self._format_file_info(file)
        except HttpError as e:
            logger.error(f"Failed to rename file {file_id}: {e}")
            raise

    def get_folder_structure(
            self, folder_id: Optional[str] = None, max_depth: int = 3) -> Dict[str, Any]:
        """Get hierarchical folder structure"""
        try:
            print(f"Getting folder structure for ID: {folder_id} with max depth {max_depth}, {not folder_id}")
            if not folder_id:
                folder_id = self.get_default_folder_id()
            print(f"Using folder ID: {folder_id}")
            folder_info = self.get_file_info(folder_id)
            structure = {
                'info': folder_info,
                'children': []
            }
            if max_depth > 0:
                files = self.list_files_in_folder(folder_id)
                for file in files:
                    if file['mimeType'] == 'application/vnd.google-apps.folder':
                        child_structure = self.get_folder_structure(
                            file['id'], max_depth - 1
                        )
                        structure['children'].append(child_structure)
                    else:
                        structure['children'].append(
                            {'info': file, 'children': []})
            return structure
        except HttpError as e:
            logger.error(
                f"Failed to get folder structure for {folder_id}: {e}")
            raise

    def get_file_permissions(self, file_id: str) -> List[Dict[str, Any]]:
        """Get file sharing permissions"""
        try:
            permissions = self.service.permissions().list(fileId=file_id).execute()
            return permissions.get('permissions', [])
        except HttpError as e:
            logger.error(f"Failed to get permissions for file {file_id}: {e}")
            raise

    def get_storage_info(self) -> Dict[str, Any]:
        """Get Google Drive storage information"""
        try:
            about = self.service.about().get(fields='storageQuota,user').execute()
            storage_quota = about.get('storageQuota', {})
            user_info = about.get('user', {})
            total = int(storage_quota.get('limit', 0))
            used = int(storage_quota.get('usage', 0))
            available = total - used if total > 0 else 0
            return {
                'user': {
                    'email': user_info.get('emailAddress'),
                    'name': user_info.get('displayName')
                },
                'storage': {
                    'total_bytes': total,
                    'used_bytes': used,
                    'available_bytes': available,
                    'total_gb': round(total / (1024**3), 2),
                    'used_gb': round(used / (1024**3), 2),
                    'available_gb': round(available / (1024**3), 2),
                    'usage_percentage': round((used / total * 100), 2) if total > 0 else 0
                }
            }
        except HttpError as e:
            logger.error(f"Failed to get storage info: {e}")
            raise

    def _format_file_info(self, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Format file information for consistent output"""
        formatted = {
            'id': file_info.get('id'),
            'name': file_info.get('name'),
            'mimeType': file_info.get('mimeType'),
            'size': int(file_info.get('size', 0)) if file_info.get('size') else None,
            'createdTime': file_info.get('createdTime'),
            'modifiedTime': file_info.get('modifiedTime'),
            'webViewLink': file_info.get('webViewLink'),
            'webContentLink': file_info.get('webContentLink'),
            'parents': file_info.get('parents', []),
            'isFolder': file_info.get('mimeType') == 'application/vnd.google-apps.folder'
        }
        if file_info.get('owners'):
            formatted['owners'] = [
                {
                    'displayName': owner.get('displayName'),
                    'emailAddress': owner.get('emailAddress')
                }
                for owner in file_info['owners']
            ]
        return {k: v for k, v in formatted.items() if v is not None}


def create_drive_service(
        credentials_path: Optional[str] = None) -> GoogleDriveService:
    """Factory function to create a Google Drive service instance"""
    return GoogleDriveService(credentials_path)

# if __name__ == "__main__":
#     # Example usage
#     drive_service = create_drive_service()
#     folder_structure = drive_service.get_folder_structure()
#     print(folder_structure)