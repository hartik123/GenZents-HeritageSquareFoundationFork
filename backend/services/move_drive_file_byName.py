from typing import Optional

def move_drive_file_by_name(service, file_name: str, destination_folder_name: str) -> str:
    """
    Find a file by its name in OHacksMirror (including subfolders) and move it to the destination folder.
    """
    try:
        # Find the file (by name)
        results = service.files().list(
            q=f"name='{file_name}' and trashed=false",
            fields="files(id, name, parents)"
        ).execute()
        files = results.get('files', [])
        if not files:
            return f"❌ File '{file_name}' not found."

        file_id = files[0]['id']

        # Find destination folder
        dest_results = service.files().list(
            q=f"mimeType='application/vnd.google-apps.folder' and name='{destination_folder_name}' and trashed=false",
            fields="files(id, name)"
        ).execute()
        dest_folders = dest_results.get('files', [])
        if not dest_folders:
            return f"❌ Destination folder '{destination_folder_name}' not found."
        destination_folder_id = dest_folders[0]['id']

        # Get file's current parent(s)
        current_parents = ",".join(files[0].get('parents', []))

        # Move the file
        service.files().update(
            fileId=file_id,
            addParents=destination_folder_id,
            removeParents=current_parents,
            fields='id, parents'
        ).execute()

        return f"✅ File '{file_name}' moved to '{destination_folder_name}'."

    except Exception as e:
        return f"❌ Error moving '{file_name}': {e}"