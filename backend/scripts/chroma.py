import os
os.environ["ANONYMIZED_TELEMETRY"] = "False"
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from chromadb import PersistentClient
from sentence_transformers import SentenceTransformer
from langchain_core.embeddings import Embeddings
from langchain_chroma import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_PATH = "./chroma_store"
COLLECTION_NAME = "drive-docs"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
BATCH_SIZE = 10

class SentenceTransformerEmbeddings(Embeddings):
    """LangChain-compatible embeddings wrapper."""
    def __init__(self, model_name: str = EMBEDDING_MODEL_NAME):
        self.model = SentenceTransformer(model_name, device='cpu')
        logger.info(f"Loaded embedding model: {model_name}")
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        vectors = self.model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        return [vector.tolist() for vector in vectors]
    
    def embed_query(self, query: str) -> List[float]:
        vector = self.model.encode([query], convert_to_numpy=True)[0]
        return vector.tolist()

class ChromaDocumentStore:
    """Main class for managing documents in ChromaDB."""
    def __init__(self):
        os.makedirs(DB_PATH, exist_ok=True)
        self.chroma_client = PersistentClient(path=DB_PATH)
        self.collection = self.chroma_client.get_or_create_collection(name=COLLECTION_NAME)
        self.embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME, device='cpu')
        self.embedding_model_lc = SentenceTransformerEmbeddings(EMBEDDING_MODEL_NAME)
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        self.vectorstore = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=self.embedding_model_lc,
            persist_directory=DB_PATH
        )
        logger.info("ChromaDB initialized")
    
    def _chunk_text(self, text: str) -> List[str]:
        """Split text using RecursiveCharacterTextSplitter for better semantic preservation."""
        if not text:
            return []
        return self.text_splitter.split_text(text)
    
    def embed_document(self, text: str, file_id: str, file_name: str, 
                      modified_time: str, size_mb: float, parent_folder_id: str,
                      tags: str = "", summary: str = "") -> bool:
        """Embed a document by chunking it and storing in ChromaDB."""
        try:
            logger.info(f"Embedding document: {file_name}")
            chunks = self._chunk_text(text)
            if not chunks:
                logger.warning(f"No chunks created for {file_name}")
                return False
            
            logger.info(f"Created {len(chunks)} chunks")
            header = f"[File: {file_name} | Modified: {modified_time} | Size: {size_mb:.2f} MB]\n"
            
            for batch_start in range(0, len(chunks), BATCH_SIZE):
                batch_chunks = chunks[batch_start:batch_start + BATCH_SIZE]
                batch_num = batch_start // BATCH_SIZE + 1
                total_batches = (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE
                logger.info(f"Processing batch {batch_num}/{total_batches}")
                
                embeddings = self.embedding_model.encode(batch_chunks, convert_to_numpy=True)
                documents = [header + chunk for chunk in batch_chunks]
                ids = [f"{file_id}_{batch_start + i}" for i in range(len(batch_chunks))]
                metadatas = [{
                    "file_id": file_id,
                    "file_name": file_name,
                    "file_path": f"{parent_folder_id}/{file_name}",
                    "summary": summary,
                    "tags": tags,
                    "chunk_index": batch_start + i,
                    "updated_at": datetime.utcnow().isoformat(),
                    "parent_folder": parent_folder_id
                } for i in range(len(batch_chunks))]
                
                self.collection.add(
                    documents=documents,
                    embeddings=[emb.tolist() for emb in embeddings],
                    ids=ids,
                    metadatas=metadatas
                )
            
            logger.info(f"Successfully embedded {file_name}: {len(chunks)} chunks")
            return True
        except Exception as e:
            logger.error(f"Error embedding {file_name}: {e}")
            return False
    
    def remove_document(self, file_id: str) -> bool:
        """Remove all chunks of a document."""
        try:
            all_items = self.collection.get(include=["metadatas"])
            ids_to_delete = [
                id_ for id_, meta in zip(all_items["ids"], all_items["metadatas"])
                if meta.get("file_id") == file_id
            ]
            if ids_to_delete:
                self.collection.delete(ids=ids_to_delete)
                logger.info(f"Removed {len(ids_to_delete)} chunks for {file_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error removing {file_id}: {e}")
            return False
    
    def search_documents(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Search documents using semantic similarity."""
        try:
            query_embedding = self.embedding_model.encode([query], convert_to_numpy=True)[0]
            results = self.collection.query(
                query_embeddings=[query_embedding.tolist()],
                n_results=top_k,
                include=["documents", "metadatas", "distances"]
            )
            matches = []
            documents = results.get("documents", [[]])[0]
            metadatas = results.get("metadatas", [[]])[0]
            distances = results.get("distances", [[]])[0]
            for doc, meta, distance in zip(documents, metadatas, distances):
                matches.append({
                    "text": doc,
                    "similarity_score": 1 - distance,
                    "file_id": meta.get("file_id", "unknown"),
                    "file_name": meta.get("file_name", "unknown"),
                    "file_path": meta.get("file_path", ""),
                    "summary": meta.get("summary", ""),
                    "tags": meta.get("tags", ""),
                    "updated_at": meta.get("updated_at", ""),
                    "parent_folder": meta.get("parent_folder", "")
                })
            logger.info(f"Found {len(matches)} matches for: {query}")
            return matches
        except Exception as e:
            logger.error(f"Error searching: {e}")
            return []
    
    def get_vectorstore(self) -> Chroma:
        """Get LangChain vectorstore for RAG."""
        return self.vectorstore

# Global instance for backward compatibility
_store = None

def get_store():
    global _store
    if _store is None:
        _store = ChromaDocumentStore()
    return _store

# Legacy functions
def embed_chunks(text, file_id, file_name, modified_time, size_mb, parent_folder_id, tags="", summary=""):
    return get_store().embed_document(text, file_id, file_name, modified_time, size_mb, parent_folder_id, tags, summary)

def remove_file(file_id):
    return get_store().remove_document(file_id)

def search_documents(query, top_k=5):
    return get_store().search_documents(query, top_k)

# For LangChain RAG
embedding_model_lc = SentenceTransformerEmbeddings(EMBEDDING_MODEL_NAME)
vectorstore = Chroma(
    collection_name=COLLECTION_NAME,
    embedding_function=embedding_model_lc,
    persist_directory=DB_PATH
)