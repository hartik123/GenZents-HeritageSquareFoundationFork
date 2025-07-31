import os
import io
import json
import PyPDF2
from backend.scripts.chroma import embed_pdf_chunks, remove_file as chroma_remove_file


# --- Google Drive Utilities ---
def download_pdf_text(drive_service, file_id):
    file_bytes = drive_service.download_file(file_id)
    fh = io.BytesIO(file_bytes)
    reader = PyPDF2.PdfReader(fh)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


def embed_and_store_pdf(drive_service, file):
    file_id = file['id']
    file_name = file['name']
    file_info = drive_service.get_file_info(file_id, fields="id,name,parents,modifiedTime,size")
    parent_folder = file_info.get("parents", ["unknown"])
    parent_folder_id = parent_folder[0] if parent_folder and isinstance(parent_folder, list) else "unknown"
    modified_time = file_info.get("modifiedTime", "unknown")
    size_str = file_info.get("size")
    try:
        size_mb = round(int(size_str) / (1024 * 1024), 2) if size_str else 0.0
    except Exception:
        size_mb = 0.0

    # Check if already embedded by trying to embed; chroma.py should handle deduplication if needed
    try:
        text = download_pdf_text(drive_service, file_id)
        embed_pdf_chunks(text, file_id, file_name, modified_time, size_mb, parent_folder_id)
        print(f"✅ Embedded '{file_name}' | Size: {size_mb} MB | Modified: {modified_time}")
    except Exception as e:
        print(f"❌ Failed to embed '{file_name}': {e}")

# --- Recursive Processing ---
def process_folder_recursively(drive_service, folder_id):
    items = drive_service.list_files(folder_id)
    for item in items:
        if item['mimeType'] == 'application/pdf':
            embed_and_store_pdf(drive_service, item)
        elif item['mimeType'] == 'application/vnd.google-apps.folder':
            print(f"📂 Entering subfolder: {item['name']}")
            process_folder_recursively(drive_service, item['id'])
        else:
            print(f"⏭️ Skipping non-PDF: {item['name']}")

def scan_folder_and_embed(drive_service, folder_name):
    folders = [f for f in drive_service.list_files() if f['name'] == folder_name and f['mimeType'] == 'application/vnd.google-apps.folder']
    if not folders:
        raise Exception(f"Folder '{folder_name}' not found.")
    folder_id = folders[0]['id']
    print(f"📁 Scanning folder '{folder_name}' recursively...")
    process_folder_recursively(drive_service, folder_id)
    # print("✅ Total chunks stored:", collection.count())

# --- Drive/Chroma Sync ---
def sync_drive_with_chroma(service, root_folder_id):
    """
    Sync Google Drive with ChromaDB, detect changes, and embed new/updated PDFs.
    Returns a summary of actions.
    """
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

    drive_files = list_all_files(root_folder_id)
    drive_map = {f["file_id"]: f for f in drive_files}
    cache_file = "last_drive_state.json"
    last_state = {}
    if os.path.exists(cache_file):
        with open(cache_file, "r") as f:
            last_state = {f["file_id"]: f for f in json.load(f)}

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

    for f in added + updated:
        if f["file_name"].lower().endswith(".pdf"):
            embed_and_store_pdf(service, {"id": f["file_id"], "name": f["file_name"]})

    with open(cache_file, "w") as f:
        json.dump(list(drive_map.values()), f, indent=2)

    return {
        "added": added,
        "updated": updated,
        "renamed": renamed,
        "moved": moved,
        "deleted": deleted,
        "unchanged": unchanged
    }
