from chromadb import PersistentClient
from sentence_transformers import SentenceTransformer
from langchain.embeddings.base import Embeddings
from langchain_community.vectorstores import Chroma

DB_PATH = "./chroma_store"
COLLECTION_NAME = "drive-docs"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

# For direct ChromaDB access (legacy, for chunking etc)
chroma_client = PersistentClient(path=DB_PATH)
collection = chroma_client.get_or_create_collection(name=COLLECTION_NAME)
embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)

# LangChain-compatible embeddings wrapper
class SentenceTransformerEmbeddings(Embeddings):
    def __init__(self, model_name: str = EMBEDDING_MODEL_NAME):
        self.model = SentenceTransformer(model_name)

    def embed_documents(self, texts):
        vectors = self.model.encode(texts, show_progress_bar=False)
        return [vector.tolist() for vector in vectors]

    def embed_query(self, query):
        vector = self.model.encode([query])[0]
        return vector.tolist()

# LangChain Chroma vectorstore for RAG
embedding_model_lc = SentenceTransformerEmbeddings(EMBEDDING_MODEL_NAME)
vectorstore = Chroma(
    collection_name=COLLECTION_NAME,
    embedding_function=embedding_model_lc,
    persist_directory=DB_PATH
)

def embed_pdf_chunks(text, file_id, file_name, modified_time, size_mb, parent_folder_id, tags: str, summary: str):
    chunks = [text[i:i+500] for i in range(0, len(text), 500)]
    embeddings = embedding_model.encode(chunks).tolist()
    from datetime import datetime
    for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        metadata_header = f"[File: {file_name} | Modified: {modified_time} | Size: {size_mb} MB]\n"
        if isinstance(chunk, bytes):
            chunk = chunk.decode('utf-8', errors='replace')
        chunk_with_metadata = metadata_header + chunk
        collection.add(
            documents=[chunk_with_metadata],
            embeddings=[embedding],
            ids=[f"{file_id}_{idx}"],
            metadatas=[{
                "file_id": file_id if file_id is not None else "",
                "file_name": file_name if file_name is not None else "",
                "file_type": False,  # PDF chunk is always a file
                "file_path": f"{parent_folder_id}/{file_name}" if parent_folder_id is not None and file_name is not None else "",
                "summary": summary if summary is not None else "",
                "tags": tags if tags is not None else "",
                "updated_at": datetime.utcnow().isoformat(),
                "parent_folder": parent_folder_id if parent_folder_id is not None else ""
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
    # Legacy direct ChromaDB search (not used in RAG pipeline)
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
            "file_id": meta.get("file_id", "unknown"),
            "file_name": meta.get("file_name", "unknown"),
            "file_type": meta.get("file_type", False),
            "file_path": meta.get("file_path", ""),
            "summary": meta.get("summary"),
            "tags": meta.get("tags", []),
            "updated_at": meta.get("updated_at"),
            "parent_folder": meta.get("parent_folder", "")
        })
    return matches