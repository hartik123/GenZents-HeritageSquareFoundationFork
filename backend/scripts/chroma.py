from chromadb import PersistentClient
from sentence_transformers import SentenceTransformer

DB_PATH = "./chroma_store"
COLLECTION_NAME = "drive-docs"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

chroma_client = PersistentClient(path=DB_PATH)
collection = chroma_client.get_or_create_collection(name=COLLECTION_NAME)
embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)

def embed_pdf_chunks(text, file_id, file_name, modified_time, size_mb, parent_folder_id):
    chunks = [text[i:i+500] for i in range(0, len(text), 500)]
    embeddings = embedding_model.encode(chunks).tolist()
    for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
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

def remove_file(file_id):
    all_items = collection.get(include=["metadatas"])
    ids_to_delete = [
        id_ for id_, meta in zip(all_items["ids"], all_items["metadatas"])
        if meta.get("file_id") == file_id
    ]
    if ids_to_delete:
        collection.delete(ids=ids_to_delete)

def search_documents(query, top_k=5):
    query_embedding = embedding_model.encode([query]).tolist()[0]
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas"]
    )
    matches = []
    for doc, meta in zip(results.get("documents", [[]])[0], results.get("metadatas", [[]])[0]):
        matches.append({
            "text": doc,
            "file_name": meta.get("file_name", "unknown"),
            "file_id": meta.get("file_id", "unknown")
        })
    return matches
