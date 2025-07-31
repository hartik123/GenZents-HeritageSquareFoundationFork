from googleapiclient.errors import HttpError
from collections import defaultdict
import os
from backend.storage.database import supabase
from backend.services.chroma import search_documents

def get_file_metadata_table():
    """
    Fetches all file metadata records from Supabase.
    Returns:
        List[dict]: List of file metadata records.
    """
    try:
        if not supabase:
            print("Supabase client not initialized.")
            return []
        response = supabase.table("file_metadata").select("*").execute()
        data = response.data if hasattr(response, 'data') else response.get('data', [])
        if not data:
            return []
        # Optionally, map keys to camelCase if needed
        return data
    except Exception as e:
        print(f"Error fetching file metadata: {e}")
        return []

def create_standard_folder_structure(service, root_folder_id: str):
    """
    Creates a standard folder hierarchy under the given root folder.
    Only creates missing folders. Returns a dict of folder paths to IDs.
    Args:
        service: Google Drive API service instance.
        root_folder_id (str): The folder ID for the root.
    Returns:
        dict: Mapping of folder paths to their Google Drive IDs.
    """
    structure = {
        "Documents": ["Reports", "Notes"],
        "Media": ["Images", "Videos"],
        "Data": ["Spreadsheets", "Presentations"]
    }
    created_folders = {}
    def get_or_create_folder(name, parent_id):
        results = service.files().list(
            q=f"mimeType='application/vnd.google-apps.folder' and name='{name}' and '{parent_id}' in parents and trashed=false",
            spaces='drive',
            fields="files(id, name)"
        ).execute()
        folders = results.get("files", [])
        if folders:
            return folders[0]['id']
        folder_metadata = {
            'name': name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id]
        }
        folder = service.files().create(body=folder_metadata, fields="id, name").execute()
        print(f"Created folder: {name} (ID: {folder['id']})")
        return folder['id']
    try:
        for main_folder, subfolders in structure.items():
            main_id = get_or_create_folder(main_folder, root_folder_id)
            created_folders[f"{main_folder}"] = main_id
            for sub in subfolders:
                sub_id = get_or_create_folder(sub, main_id)
                created_folders[f"{main_folder}/{sub}"] = sub_id
        print("Standard folder structure is ready.")
        return created_folders
    except HttpError as e:
        print(f"Failed to create structure: {e}")
        return {}

def organize_existing_drive_files(service, root_folder_id, folder_map=None, apply_changes=False):
    """
    Organizes files in Google Drive under the root folder into a standard structure.
    Args:
        service: Google Drive API service instance.
        root_folder_id: The root folder ID.
        folder_map: Optional mapping of categories to folder IDs.
        apply_changes: If True, actually move files. If False, just preview.
    Returns:
        dict: Status and structure summary.
    """
    summary = defaultdict(list)
    name_tracker = defaultdict(int)
    def list_all_items(folder_id):
        results = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name, mimeType, parents)"
        ).execute()
        items = results.get("files", [])
        all_items = []
        for item in items:
            if item["mimeType"] == "application/vnd.google-apps.folder":
                all_items.extend(list_all_items(item["id"]))
            else:
                all_items.append(item)
        return all_items
    def rename_if_duplicate(filename):
        name, ext = os.path.splitext(filename)
        name_tracker[filename] += 1
        if name_tracker[filename] > 1:
            return f"{name}({name_tracker[filename]}){ext}"
        return filename
    def suggest_category(item):
        # Simple category suggestion based on file extension
        ext = os.path.splitext(item["name"])[1].lower()
        if ext in [".jpg", ".jpeg", ".png", ".gif"]:
            return "Media/Images"
        if ext in [".mp4", ".mov", ".avi"]:
            return "Media/Videos"
        if ext in [".pdf", ".docx", ".doc", ".txt"]:
            return "Documents/Notes"
        if ext in [".xlsx", ".csv"]:
            return "Data/Spreadsheets"
        if ext in [".pptx", ".ppt"]:
            return "Data/Presentations"
        return "Documents/Reports"
    all_items = list_all_items(root_folder_id)
    if not all_items:
        print("No files found to organize.")
        return {"status": "empty", "structure": {}}
    already_organized = True
    for item in all_items:
        expected_category = suggest_category(item)
        parents = item.get("parents", [])
        # This check is simplistic; in real use, check actual folder names by ID
        if not parents:
            already_organized = False
        clean_name = rename_if_duplicate(item["name"])
        summary[expected_category].append(clean_name)
    if already_organized:
        print("Drive is already organized. No changes needed.")
        return {"status": "organized", "structure": dict(summary)}
    print("Proposed Folder Structure (Preview):")
    for category, files in summary.items():
        print(f"- {category}: {len(files)} file(s)")
    if not apply_changes:
        print("No changes were made.")
        return {"status": "preview", "structure": dict(summary)}
    for category, files in summary.items():
        folder_parts = category.split("/")
        parent_id = root_folder_id
        for part in folder_parts:
            results = service.files().list(
                q=f"mimeType='application/vnd.google-apps.folder' and name='{part}' and '{parent_id}' in parents and trashed=false",
                fields="files(id, name)"
            ).execute()
            folders = results.get("files", [])
            if folders:
                folder_id = folders[0]['id']
            else:
                folder = service.files().create(
                    body={"name": part, "mimeType": "application/vnd.google-apps.folder", "parents": [parent_id]},
                    fields="id, name"
                ).execute()
                folder_id = folder['id']
            parent_id = folder_id
        for file_name in files:
            results = service.files().list(
                q=f"name='{file_name}' and trashed=false",
                fields="files(id, parents)"
            ).execute()
            matched_files = results.get("files", [])
            if matched_files:
                file_id = matched_files[0]['id']
                old_parents = ",".join(matched_files[0].get("parents", []))
                service.files().update(
                    fileId=file_id,
                    addParents=parent_id,
                    removeParents=old_parents,
                    fields="id, parents"
                ).execute()
                print(f"Moved '{file_name}' → {category}")
    print("Drive has been reorganized based on the proposed structure.")
    return {"status": "applied", "structure": dict(summary)}