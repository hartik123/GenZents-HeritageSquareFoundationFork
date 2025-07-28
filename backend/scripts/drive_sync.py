from chromadb import PersistentClient
from scan_and_embed_drive import embed_and_store_pdf
from googleapiclient.errors import HttpError

# Initialize ChromaDB client
db_path = "./chroma_store"
chroma_client = PersistentClient(path=db_path)
collection = chroma_client.get_or_create_collection(name="drive-docs")


def get_all_drive_files(service, root_folder_id):
    """Recursively fetch all PDF files in a folder (including subfolders)."""
    files = {}

    def list_pdfs_in_folder(folder_id):
        page_token = None
        while True:
            response = service.files().list(
                q=f"'{folder_id}' in parents and trashed=false",
                fields="nextPageToken, files(id, name, parents, mimeType, modifiedTime, size)",
                pageToken=page_token
            ).execute()
            for file in response.get('files', []):
                mime = file.get("mimeType", "")
                if mime == "application/pdf":
                    files[file['id']] = file
                elif mime == "application/vnd.google-apps.folder":
                    list_pdfs_in_folder(file['id'])  # recurse
            page_token = response.get('nextPageToken', None)
            if page_token is None:
                break

    list_pdfs_in_folder(root_folder_id)
    return files


def remove_file_from_chroma(file_id):
    """Remove a file and its chunks from ChromaDB."""
    all_items = collection.get(include=["metadatas"])
    ids_to_delete = [
        id_ for id_, meta in zip(all_items["ids"], all_items["metadatas"])
        if meta.get("file_id") == file_id
    ]
    if ids_to_delete:
        collection.delete(ids=ids_to_delete)


def sync_drive_with_chroma(service, folder_id):
    """
    Sync Google Drive with ChromaDB, detect all changes, and embed new/updated files.
    Returns a summary of all actions.
    """
    print("🔍 Scanning Google Drive and ChromaDB...")

    try:
        drive_files = get_all_drive_files(service, folder_id)
    except HttpError as e:
        print(f"⚠️ Error scanning Drive: {e}")
        return {}

    chroma_items = collection.get(include=["metadatas"])
    chroma_files = {meta["file_id"]: meta for meta in chroma_items["metadatas"] if meta.get("file_id")}

    summary = {
        "added": [],
        "deleted": [],
        "renamed": [],
        "moved": [],
        "updated": [],
        "duplicates": [],
        "corrupted": [],
    }

    # Detect Added or Updated
    for file_id, drive_meta in drive_files.items():
        chroma_meta = chroma_files.get(file_id)
        try:
            if not chroma_meta:
                summary["added"].append(drive_meta['name'])
                embed_and_store_pdf(service, drive_meta)
            else:
                # Check name change
                if chroma_meta.get("file_name") != drive_meta["name"]:
                    summary["renamed"].append(f"{chroma_meta.get('file_name')} → {drive_meta['name']}")

                # Check folder move
                if chroma_meta.get("parent_folder") != drive_meta.get("parents", ["root"])[0]:
                    summary["moved"].append(drive_meta["name"])

                # Check modifiedTime or size
                if drive_meta.get("modifiedTime") > chroma_meta.get("modified_time", "") or \
                        int(drive_meta.get("size", 0)) != int(chroma_meta.get("size_mb", 0) * 1024 * 1024):
                    summary["updated"].append(drive_meta['name'])
                    remove_file_from_chroma(file_id)
                    embed_and_store_pdf(service, drive_meta)
        except Exception:
            summary["corrupted"].append(drive_meta['name'])

    # Detect Deleted
    for file_id, meta in chroma_files.items():
        if file_id not in drive_files:
            summary["deleted"].append(meta["file_name"])
            remove_file_from_chroma(file_id)

    # Detect Duplicates (by name & size)
    seen = {}
    for file in drive_files.values():
        key = (file['name'], file.get('size', 0))
        seen.setdefault(key, []).append(file['id'])
    summary["duplicates"] = [name for (name, _), ids in seen.items() if len(ids) > 1]

    # Print summary
    print("\n📊 Sync Summary:")
    for category, files in summary.items():
        print(f"- {category.capitalize()}: {len(files)}")
        for f in files[:5]:  # Show top 5 per category
            print(f"   • {f}")
        if len(files) > 5:
            print(f"   ...and {len(files) - 5} more")

    return summary