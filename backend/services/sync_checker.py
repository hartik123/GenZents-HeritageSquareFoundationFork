from chromadb import PersistentClient
from scan_and_embed_drive import embed_and_store_pdf

def get_all_drive_files(service, root_folder_id):
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
                if file.get("mimeType") == "application/pdf":
                    files[file['id']] = file
                elif file.get("mimeType") == "application/vnd.google-apps.folder":
                    # Recurse into subfolder
                    list_pdfs_in_folder(file['id'])
            page_token = response.get('nextPageToken', None)
            if page_token is None:
                break

    list_pdfs_in_folder(root_folder_id)
    print(f"Total PDFs found: {len(files)}")
    return files

# Initialize ChromaDB client and collection
db_path = "./chroma_store"
chroma_client = PersistentClient(path=db_path)
collection = chroma_client.get_or_create_collection(name="drive-docs")

def remove_file_from_chroma(file_id):
    all_items = collection.get(include=["metadatas"])
    ids_to_delete = [
        id_ for id_, meta in zip(all_items["ids"], all_items["metadatas"])
        if meta.get("file_id") == file_id
    ]
    if ids_to_delete:
        collection.delete(ids=ids_to_delete)
        print(f"🗑️ Removed file {file_id} from ChromaDB.")

def sync_drive_with_chroma(service, folder_id):
    print("Starting sync...")
    drive_files = get_all_drive_files(service, folder_id)
    print(f"Drive files found: {len(drive_files)}")
    chroma_items = collection.get(include=["metadatas"])
    chroma_files = {meta["file_id"]: meta for meta in chroma_items["metadatas"] if meta.get("file_id")}

    # New or updated files
    for file_id, drive_meta in drive_files.items():
        chroma_meta = chroma_files.get(file_id)
        if not chroma_meta:
            print(f"🆕 New file detected: {drive_meta['name']}")
            embed_and_store_pdf(service, drive_meta)
        else:
            if drive_meta.get("modifiedTime") > chroma_meta.get("modified_time", ""):
                print(f"🔄 Updated file detected: {drive_meta['name']}")
                remove_file_from_chroma(file_id)
                embed_and_store_pdf(service, drive_meta)

    # Deleted files
    for file_id in chroma_files:
        if file_id not in drive_files:
            print(f"❌ File deleted from Drive: {chroma_files[file_id]['file_name']}")
            remove_file_from_chroma(file_id)
