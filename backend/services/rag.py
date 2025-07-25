from datetime import datetime
import os
import io
from utils.logger import logger
import fitz  # PyMuPDF
import chromadb
from sentence_transformers import SentenceTransformer
from googleapiclient.http import MediaIoBaseDownload
from scripts.google_drive import GoogleDriveService


class RAG():
    _self = None
    def __new__(cls,*args, **kwargs):
        if cls._self is None:
            cls._self = super().__new__(cls)
        return cls._self
    
    def __init__(self, DriveService: GoogleDriveService):
        # pass in Google Drive object (should be a singleton)
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.chroma_client = chromadb.PersistentClient(path="./chroma_store")
        self.drive = DriveService
        self.vector_store = self.initialize_vector_store()
    
    def initialize_vector_store(self):
        """Initialize vector store and only embed new files"""
        # Get or create collection
        vector_store = self.chroma_client.get_or_create_collection(name="drive-docs")
        
        # Get all files from Drive
        files = self.drive.list_all_file_metadata()
        
        # Get existing file IDs from vector store
        existing_ids = set()
        if vector_store.count() > 0:
            # Get all metadata from vector store
            existing_metadata = vector_store.get()
            for metadata in existing_metadata['metadatas']:
                if metadata:
                    existing_ids.add(metadata['file_id'])
        
        # Process only new files
        for file in files:
            if (file['mimeType'] != "application/vnd.google-apps.folder" and 
                file['id'] not in existing_ids):
                try:
                    # Download and process new file
                    text = self.drive.download_and_get_file_content(file['id'], file['mimeType'])
                    if not text:  # Skip if no content
                        continue
                        
                    # Create chunks
                    chunks = [text[i:i+500] for i in range(0, len(text), 500)]
                    
                    # Generate embeddings
                    embeddings = self.embedding_model.encode(chunks).tolist()
                    
                    # Add to vector store
                    for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                        vector_store.add(
                            documents=[chunk],
                            embeddings=[embedding],
                            ids=[f"{file['id']}_{idx}"],
                            metadatas=[{
                                "file_id": file['id'], 
                                "file_name": file['name'],
                                "chunk_index": idx,
                                "total_chunks": len(chunks),
                                "added_at": datetime.utcnow().isoformat()
                            }]
                        )
                    logger.info(f"Embedded new file: '{file['name']}' ({len(chunks)} chunks)")
                except Exception as e:
                    logger.error(f"Error processing file '{file['name']}': {str(e)}")
                    continue
        
        return vector_store

    def retrieve(self,query):
        retrieved_docs = self.vector_store.query(query_texts=query)
        return retrieved_docs