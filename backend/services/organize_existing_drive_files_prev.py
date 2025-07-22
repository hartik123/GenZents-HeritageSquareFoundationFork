import json
from googleapiclient.errors import HttpError

def organize_existing_drive_files(service, root_folder_id: str, folder_map: dict, rules_file="services/classification_rules.json"):
    """
    Dynamically organizes all files in OHacksMirror into folders based on classification rules.
    Rules are loaded from an external JSON file and mapped against the folder_map from Tool 1.

    Args:
        service: Google Drive API service instance.
        root_folder_id (str): OHacksMirror folder ID.
        folder_map (dict): Mapping of "Folder/Subfolder" → Drive folder IDs (from Tool 1).
        rules_file (str): Path to the JSON file containing classification rules.

    Returns:
        dict: Summary of file counts moved into each folder.
    """
    # Load rules
    with open(rules_file, "r") as f:
        rules_config = json.load(f)
    rules = rules_config.get("rules", [])
    default_pdf = rules_config.get("default_pdf_folder", "Miscellaneous")
    default_misc = rules_config.get("default_misc_folder", "Miscellaneous")

    summary = {key: 0 for key in folder_map.keys()}
    summary[default_misc] = 0

    def list_all_files(folder_id):
        """Recursively list all non-folder files."""
        results = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name, mimeType, parents)"
        ).execute()
        files = results.get("files", [])
        all_files = []
        for f in files:
            if f["mimeType"] == "application/vnd.google-apps.folder":
                all_files.extend(list_all_files(f["id"]))
            else:
                all_files.append(f)
        return all_files

    def move_file(file_id, new_parent_id, old_parent_id=None):
        """Move a file into a new folder."""
        if not old_parent_id:
            file_info = service.files().get(fileId=file_id, fields="parents").execute()
            old_parent_id = file_info.get("parents", [None])[0]
        service.files().update(
            fileId=file_id,
            addParents=new_parent_id,
            removeParents=old_parent_id,
            fields="id, parents"
        ).execute()

    try:
        all_files = list_all_files(root_folder_id)
        print(f"🔍 Found {len(all_files)} files to classify and move...")

        for file in all_files:
            name = file["name"].lower()
            mime = file.get("mimeType", "")

            target_folder = None

            # Check each rule
            for rule in rules:
                if any(kw.lower() in name for kw in rule["keywords"]):
                    target_folder = rule["target_folder"]
                    break

            # Fallback based on file type
            if not target_folder:
                if mime.endswith("pdf"):
                    target_folder = default_pdf
                elif "spreadsheet" in mime or name.endswith((".xls", ".xlsx", ".csv")):
                    target_folder = "Operations/Reports"
                elif "presentation" in mime or name.endswith((".ppt", ".pptx")):
                    target_folder = "Marketing/Media"

            # Final fallback
            if not target_folder:
                target_folder = default_misc

            # Resolve the Drive folder ID
            new_parent_id = folder_map.get(target_folder, folder_map.get(default_misc))
            old_parent_id = file.get("parents", [root_folder_id])[0]

            move_file(file["id"], new_parent_id, old_parent_id)
            print(f"📂 Moved '{file['name']}' → {target_folder}")
            summary[target_folder] = summary.get(target_folder, 0) + 1

        print("\n✅ All files organized!")
        return summary

    except HttpError as e:
        print(f"❌ Error organizing files: {e}")
        return {} 