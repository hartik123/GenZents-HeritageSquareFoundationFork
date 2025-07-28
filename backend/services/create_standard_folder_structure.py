from googleapiclient.errors import HttpError

def create_standard_folder_structure(service, root_folder_id: str):
    """
    Creates the standard folder hierarchy under OHacksMirror.
    Only creates missing folders and returns a dict of folder names to IDs.

    Args:
        service: Google Drive API service instance.
        root_folder_id (str): The folder ID for OHacksMirror.

    Returns:
        dict: Mapping of folder paths to their Google Drive IDs.
    """

    # Define the desired structure (nested)
    structure = {
        "Grants": ["2025", "2024", "Archive"],
        "Marketing": ["Campaigns", "Media"],
        "Operations": ["Reports", "Schedules"],
        "Miscellaneous": []
    }

    created_folders = {}

    def get_or_create_folder(name, parent_id):
        """Returns the folder ID (creates folder if it doesn't exist)."""
        results = service.files().list(
            q=f"mimeType='application/vnd.google-apps.folder' and name='{name}' and '{parent_id}' in parents and trashed=false",
            spaces='drive',
            fields="files(id, name)"
        ).execute()
        folders = results.get("files", [])
        if folders:
            return folders[0]['id']

        # Create the folder if it doesn't exist
        folder_metadata = {
            'name': name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id]
        }
        folder = service.files().create(body=folder_metadata, fields="id, name").execute()
        print(f"📁 Created folder: {name} (ID: {folder['id']})")
        return folder['id']

    try:
        # Loop through structure and create folders
        for main_folder, subfolders in structure.items():
            main_id = get_or_create_folder(main_folder, root_folder_id)
            created_folders[f"{main_folder}"] = main_id
            for sub in subfolders:
                sub_id = get_or_create_folder(sub, main_id)
                created_folders[f"{main_folder}/{sub}"] = sub_id

        print("\n✅ Standard folder structure is ready.")
        return created_folders

    except HttpError as e:
        print(f"❌ Failed to create structure: {e}")
        return {}