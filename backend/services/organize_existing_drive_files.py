import json
from googleapiclient.errors import HttpError
from typing import Dict, Any

def organize_existing_drive_files(service, folder_id, folder_map, apply_changes=False) -> Dict[str, Any]:
    """
    Analyze and optionally organize the Google Drive folder structure.
    If apply_changes is False, only suggest moves (dry run).
    If apply_changes is True, actually move/rename files/folders.
    Returns a summary of suggested or applied moves.
    """
    # Example categories (customize as needed)
    categories = ["Grants", "Marketing", "Operations", "Miscellaneous"]
    summary = {cat: [] for cat in categories}
    summary["Uncategorized"] = []

    # List all files/folders in the root folder
    results = service.files().list(
        q=f"'{folder_id}' in parents and trashed=false",
        fields="files(id, name, mimeType, parents)"
    ).execute()
    items = results.get('files', [])

    # Example: categorize by file/folder name keywords
    for item in items:
        name = item["name"].lower()
        moved = False
        for cat in categories:
            if cat.lower() in name:
                summary[cat].append(item["name"])
                moved = True
                if apply_changes:
                    # Move to the category folder if not already there
                    cat_folder_id = folder_map.get(cat)
                    if cat_folder_id and cat_folder_id not in item.get("parents", []):
                        service.files().update(fileId=item["id"], addParents=cat_folder_id, removeParents=folder_id).execute()
                break
        if not moved:
            summary["Uncategorized"].append(item["name"])
            if apply_changes:
                # Move to Miscellaneous if not already there
                misc_folder_id = folder_map.get("Miscellaneous")
                if misc_folder_id and misc_folder_id not in item.get("parents", []):
                    service.files().update(fileId=item["id"], addParents=misc_folder_id, removeParents=folder_id).execute()

    if apply_changes:
        return {"status": "applied", "moves": summary}
    else:
        return {"status": "suggested", "moves": summary}