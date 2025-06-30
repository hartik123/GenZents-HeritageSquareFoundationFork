# Create a vector store for all files in the Google Drive
# RAG: 1. Indexing (load, split, store) 2. Retrieval and Generation (retrieve, generate)
import os
import time
from dotenv import load_dotenv
load_dotenv()

# import langchain 
from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec
from langchain_google_community import GoogleDriveLoader
from services import google_drive 
from langchain_community.document_loaders import UnstructuredFileIOLoader

from api import chats

pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))
index_name = os.environ.get("PINECONE_API_INDEX_NAME")
existing_indexes = [index_info['name'] for index_info in pc.list_indexes()]

if index_name not in existing_indexes:
    pc.create_index(
        name=index_name,
        dimension=3072,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
    )
    while not pc.describe_index(index_name).status['ready']:
        time.sleep(1)
index=pc.Index(index_name)

# init embeddings model and vector store
embeddings = OpenAIEmbeddings(model="text-embedding-3-large", api_key=os.environ.get("OPENAI_API_KEY"))
vector_store = PineconeVectorStore(index=index, embedding=embeddings)

# list all file ids in the Google Workspace
service = google_drive.GoogleDriveService()
results = service.list_files()
items = results.get("files",[])
file_ids = {}
for item in items:
    file_ids[item['name']] = item['id']
    print(f"{item['name']} ({item['id']})")

# loader: load all files in Google drive to create a knowledge base for the chatbot
loader = GoogleDriveLoader(
    file_ids=file_ids, 
    file_loader_cls=UnstructuredFileIOLoader,
    file_loader_kwargs={"mode": "elements"},
)
docs = loader.load()

# split the document
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=400,
    length_function=len,
    is_separator_regex=False,
)

# create chunks
documents=text_splitter.split_documents(docs)

# generate unique ids
i=0
uids = []
while i < len(documents):
    i+=1
    uids.append(f"id{i}")

# add to vector database
vector_store.add_documents(documents=documents, ids=uids)




