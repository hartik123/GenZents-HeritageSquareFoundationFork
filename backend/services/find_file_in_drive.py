# services/find_file_in_drive.py
from googleapiclient.discovery import Resource
from typing import Optional, Dict, List
from datetime import datetime

def find_file_in_drive(service: Resource, root_folder_id: str, file_name: str) -> str:
    """
    Searches the Google Drive recursively for a file by name and returns its folder path.

    Args:
        service: Authenticated Google Drive API service.
        root_folder_id (str): The ID of the root folder (OHacksMirror).
        file_name (str): The name of the file to search for.

    Returns:
        str: The full folder path where the file is located, or a not-found message.
    """
    file_name = file_name.lower().strip()
    matches: List[Dict] = []

    def list_files_recursive(folder_id: str, current_path: str):
        results = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name, mimeType, parents, modifiedTime)"
        ).execute()
        items = results.get('files', [])

        for item in items:
            if item['mimeType'] == 'application/vnd.google-apps.folder':
                list_files_recursive(item['id'], f"{current_path}/{item['name']}")
            else:
                if file_name in item['name'].lower():
                    matches.append({
                        "id": item['id'],
                        "name": item['name'],
                        "path": current_path,
                        "modifiedTime": item.get("modifiedTime", "")
                    })

    list_files_recursive(root_folder_id, "OHacksMirror")

    if not matches:
        return f"❌ File '{file_name}' not found in Google Drive."

    # Sort by modifiedTime (latest first)
    matches.sort(key=lambda x: x["modifiedTime"], reverse=True)
    latest = matches[0]

    return (
        f"✅ Found '{latest['name']}' in folder: {latest['path']}\n"
        f"Last modified: {latest['modifiedTime']}"
    )