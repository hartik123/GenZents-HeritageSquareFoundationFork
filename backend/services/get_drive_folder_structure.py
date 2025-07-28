def get_drive_folder_structure(service, root_folder_id):
    """
    Recursively lists the entire folder structure with file details (name, size, last modified).
    """

    def list_folder_contents(folder_id, indent=0):
        results = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name, mimeType, size, modifiedTime)"
        ).execute()

        items = results.get('files', [])
        structure = ""

        for item in items:
            prefix = "  " * indent
            if item['mimeType'] == 'application/vnd.google-apps.folder':
                structure += f"{prefix}- {item['name']}/\n"
                structure += list_folder_contents(item['id'], indent + 1)
            else:
                size_mb = round(int(item.get("size", 0)) / (1024 * 1024), 2) if "size" in item else 0
                last_mod = item.get("modifiedTime", "unknown")
                structure += f"{prefix}  • {item['name']} (Size: {size_mb} MB, Modified: {last_mod})\n"

        return structure

    return list_folder_contents(root_folder_id)