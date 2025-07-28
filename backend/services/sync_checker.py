from chromadb import PersistentClient
from scan_and_embed_drive import embed_and_store_pdf

def sync_drive_with_chroma(service, root_folder_id):
    print("\n🔍 Scanning Google Drive...")
    db_path = "./chroma_store"
    chroma_client = PersistentClient(path=db_path)
    collection = chroma_client.get_or_create_collection(name="drive-docs")

    # Recursive file listing
    def list_all_files(folder_id, parent_folder=None):
        files = []
        response = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name, mimeType, parents, modifiedTime, size)"
        ).execute()
        for file in response.get('files', []):
            if file["mimeType"] == "application/vnd.google-apps.folder":
                files.extend(list_all_files(file["id"], file["name"]))
            else:
                files.append({
                    "file_id": file["id"],
                    "file_name": file["name"],
                    "parent_folder": parent_folder or "root",
                    "modified_time": file.get("modifiedTime", ""),
                    "size_mb": round(int(file.get("size", 0)) / (1024 * 1024), 2),
                })
        return files

    # Current state
    drive_files = list_all_files(root_folder_id)
    drive_map = {f["file_id"]: f for f in drive_files}

    # Load last state from local cache (JSON file)
    import json, os
    cache_file = "last_drive_state.json"
    last_state = {}
    if os.path.exists(cache_file):
        with open(cache_file, "r") as f:
            last_state = {f["file_id"]: f for f in json.load(f)}

    # Detect changes
    added, updated, deleted, renamed, moved, unchanged = [], [], [], [], [], []
    for fid, current in drive_map.items():
        old = last_state.get(fid)
        if not old:
            added.append(current)
        else:
            if current["file_name"] != old.get("file_name"):
                renamed.append(current)
            elif current["parent_folder"] != old.get("parent_folder"):
                moved.append(current)
            elif (current["modified_time"] != old.get("modified_time") or
                  current["size_mb"] != old.get("size_mb")):
                updated.append(current)
            else:
                unchanged.append(current)
    for fid, old in last_state.items():
        if fid not in drive_map:
            deleted.append(old)

    # Embed PDFs for new/updated
    for f in added + updated:
        if f["file_name"].lower().endswith(".pdf"):
            embed_and_store_pdf(service, {"id": f["file_id"], "name": f["file_name"]})

    # Save new state to cache
    with open(cache_file, "w") as f:
        json.dump(list(drive_map.values()), f, indent=2)

    # Print summary
    print("\n📋 Sync Summary:")
    print(f"- ADDED: {len(added)}")
    print(f"- UPDATED: {len(updated)}")
    print(f"- RENAMED: {len(renamed)}")
    print(f"- MOVED: {len(moved)}")
    print(f"- DELETED: {len(deleted)}")
    print(f"- UNCHANGED: {len(unchanged)}")

    return {
        "added": added,
        "updated": updated,
        "renamed": renamed,
        "moved": moved,
        "deleted": deleted,
        "unchanged": unchanged
    }