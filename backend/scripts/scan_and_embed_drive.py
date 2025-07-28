import os
import io
import PyPDF2
import chromadb
from chromadb import PersistentClient
from sentence_transformers import SentenceTransformer
from googleapiclient.http import MediaIoBaseDownload

# Initialize embedding model and Chroma
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
chroma_client = PersistentClient(path="./chroma_store")
collection = chroma_client.get_or_create_collection(name="drive-docs")

def download_pdf_text(service, file_id):
    request = service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    fh.seek(0)
    reader = PyPDF2.PdfReader(fh)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text

def get_folder_id(service, folder_name):
    response = service.files().list(
        q=f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        spaces='drive',
        fields='files(id, name)'
    ).execute()
    folders = response.get('files', [])
    if not folders:
        raise Exception(f"Folder '{folder_name}' not found.")
    return folders[0]['id']

def list_folder_contents(service, folder_id):
    query = f"'{folder_id}' in parents and trashed=false"
    results = service.files().list(
        q=query,
        fields="files(id, name, mimeType)"
    ).execute()
    return results.get('files', [])

def embed_and_store_pdf(service, file):
    file_id = file['id']
    file_name = file['name']

    # Get metadata
    file_info = service.files().get(
        fileId=file_id, fields="id, name, parents, modifiedTime, size"
    ).execute()
    print(f"[DEBUG] file_info for {file_name}: {file_info}")

    # Robust metadata extraction
    parent_folder = file_info.get("parents", ["unknown"])
    if not parent_folder or not isinstance(parent_folder, list):
        print(f"[WARN] No parent folder for {file_name}")
        parent_folder_id = "unknown"
    else:
        parent_folder_id = parent_folder[0]

    modified_time = file_info.get("modifiedTime")
    if not modified_time:
        print(f"[WARN] No modifiedTime for {file_name}")
        modified_time = "unknown"

    size_str = file_info.get("size")
    if not size_str:
        print(f"[WARN] No size for {file_name}")
        size_mb = 0.0
    else:
        try:
            size_bytes = int(size_str)
            size_mb = round(size_bytes / (1024 * 1024), 2)
        except Exception as e:
            print(f"[WARN] Could not parse size for {file_name}: {e}")
            size_mb = 0.0

    # Avoid duplicates
    existing = collection.get(include=["metadatas"])
    existing_file_ids = {meta.get("file_id") for meta in existing["metadatas"] if meta.get("file_id")}
    if file_id in existing_file_ids:
        print(f"🔁 Skipping already embedded file: {file_name}")
        return

    try:
        text = download_pdf_text(service, file_id)
        chunks = [text[i:i+500] for i in range(0, len(text), 500)]
        embeddings = embedding_model.encode(chunks).tolist()

        for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            # Prepend metadata header to each chunk
            metadata_header = f"[File: {file_name} | Modified: {modified_time} | Size: {size_mb} MB]\n"
            chunk_with_metadata = metadata_header + chunk
            collection.add(
                documents=[chunk_with_metadata],
                embeddings=[embedding],
                ids=[f"{file_id}_{idx}"],
                metadatas=[{
                    "file_id": file_id,
                    "file_name": file_name,
                    "modified_time": modified_time,
                    "size_mb": size_mb,
                    "parent_folder": parent_folder_id
                }]
            )

        print(f"✅ Embedded '{file_name}' ({len(chunks)} chunks) | Size: {size_mb} MB | Modified: {modified_time}")

    except Exception as e:
        print(f"❌ Failed to embed '{file_name}': {e}")

def process_folder_recursively(service, folder_id):
    items = list_folder_contents(service, folder_id)
    for item in items:
        if item['mimeType'] == 'application/pdf':
            embed_and_store_pdf(service, item)
        elif item['mimeType'] == 'application/vnd.google-apps.folder':
            print(f"📂 Entering subfolder: {item['name']}")
            process_folder_recursively(service, item['id'])
        else:
            print(f"⏭️ Skipping non-PDF: {item['name']}")

def scan_folder_and_embed(service, folder_name):
    folder_id = get_folder_id(service, folder_name)
    print(f"📁 Scanning folder '{folder_name}' recursively...")
    process_folder_recursively(service, folder_id)
    print("💾 Chroma DB persisted to disk.")
    print("✅ Total chunks stored:", collection.count())

# Test: Verify metadata stored in Chroma
def test_chroma_metadata():
    all_items = collection.get(include=["metadatas"])
    print(f"🔍 Total vectors in Chroma: {len(all_items['ids'])}")

    # Show the first 5 entries to confirm metadata
    for i, meta in enumerate(all_items["metadatas"][:5]):
        print(f"\nEntry {i+1}:")
        print(f"  File Name: {meta.get('file_name')}")
        print(f"  File ID: {meta.get('file_id')}")
        print(f"  Parent Folder ID: {meta.get('parent_folder')}")
        print(f"  Modified Time: {meta.get('modified_time')}")
        print(f"  Size (MB): {meta.get('size_mb')}")

def query_drive_metadata(
    file_name: str = None,
    parent_folder: str = None,
    modified_after: str = None,
    modified_before: str = None,
    min_size_mb: float = None,
    max_size_mb: float = None
) -> list:
    all_items = collection.get(include=["metadatas"])
    matching_files = []

    for meta in all_items["metadatas"]:
        match = True
        if file_name and meta.get("file_name") != file_name:
            match = False
        if parent_folder and meta.get("parent_folder") != parent_folder:
            match = False
        if modified_after and meta.get("modified_time") < modified_after:
            match = False
        if modified_before and meta.get("modified_time") > modified_before:
            match = False
        if min_size_mb is not None and meta.get("size_mb") < min_size_mb:
            match = False
        if max_size_mb is not None and meta.get("size_mb") > max_size_mb:
            match = False

        if match:
            matching_files.append(meta)

    return matching_files

if __name__ == "__main__":
    # After embedding is done
    test_chroma_metadata()