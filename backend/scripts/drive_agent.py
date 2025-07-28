import os
import logging
from dotenv import load_dotenv
from langchain.agents import initialize_agent, AgentType
from langchain.tools import Tool
from langchain.memory import ConversationBufferMemory
import tqdm
from services.sync_checker import sync_drive_with_chroma
from backend.storage.supabase_client import fetch_recent_changes
from services.search_drive import search_drive_documents
from services.move_drive_file import move_drive_file
from services.summarize_drive_file import handle_summarize_request
from services.create_standard_folder_structure import create_standard_folder_structure
from services.organize_existing_drive_files import organize_existing_drive_files
from services.get_drive_folder_structure import get_drive_folder_structure
from scan_and_embed_drive import scan_folder_and_embed
from services.move_drive_file_byName import move_drive_file_by_name
from services.find_file_in_drive import find_file_in_drive
from services.generative_ai import generate_text
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# ---- Patch tqdm to avoid errors ----
class disabled_tqdm:
    def __init__(self, *args, **kwargs): pass
    def update(self, *args, **kwargs): pass
    def close(self): pass
    def __iter__(self): return iter([])
    def __enter__(self): return self
    def __exit__(self, *exc): pass

tqdm.tqdm = disabled_tqdm

# ---- Load environment ----
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    filename="logs/agent.log",
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

# ---- Google Drive Auth ----
SCOPES = ['https://www.googleapis.com/auth/drive']
CREDENTIALS_FILE = 'client_secret_634158695245-ncmbo57t3e61ubjfoqaa7c422tpdnoti.apps.googleusercontent.com.json'

def authenticate():
    import pickle
    creds = None
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    if not creds:
        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
        creds = flow.run_local_server(port=0)
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    return build('drive', 'v3', credentials=creds)

# ---- Flags ----
already_organized_session = False

# ---- Wrappers ----
def run_drive_organization():
    global already_organized_session
    proposed_summary = organize_existing_drive_files(service, folder_id, apply_changes=False)
    if proposed_summary.get("status") == "organized":
        already_organized_session = True
        return "Drive is already organized. No changes made."
    summary = organize_existing_drive_files(service, folder_id, apply_changes=True)
    already_organized_session = True
    return f"Drive organized: {summary.get('status', 'done')}."

def run_sync_with_summary():
    print("\n🔄 Starting Drive sync (with ChromaDB for PDFs)...")
    summary = sync_drive_with_chroma(service, folder_id) or {}
    for key in ["added", "updated", "deleted", "renamed", "moved", "unchanged"]:
        summary.setdefault(key, [])

    # Display results to user
    print("\n📋 Drive Sync Results:")
    for action, files in summary.items():
        print(f"- {action.upper()}: {len(files)}")
        for f in files:
            print(f"    • {f['file_name']} (Parent: {f['parent_folder']})")

    return "Drive sync complete. Changes listed above."

# ---- LangChain Tools ----
tools = [
    Tool("SearchDriveDocuments", lambda q: search_drive_documents(q),
         "Search embedded Drive documents and return relevant text chunks."),
    Tool("GenerateAnswerWithLLM", lambda q: generate_text(q + " " + search_drive_documents(q)),
         "Generate an answer using Groq LLaMA and Drive documents."),
    Tool("SummarizeDriveFile", lambda q: handle_summarize_request(q, service),
         "Summarize a PDF file from Google Drive."),
    Tool("MoveDriveFile", lambda f: move_drive_file(service, *f.split(",")),
         "Move a file into another folder. Input: 'file_name,destination_folder_name'."),
    Tool("CreateFolderStructure", lambda _: create_standard_folder_structure(service, folder_id),
         "Suggest and create a standardized folder hierarchy for OHacksMirror."),
    Tool("OrganizeExistingFiles", lambda _: (
        "Organization already completed this session."
        if already_organized_session else run_drive_organization()
    ), "Analyze and organize Drive dynamically, but only once per session."),
    Tool("SyncChromaWithDrive", lambda _: run_sync_with_summary(),
         "Sync Google Drive with ChromaDB and Supabase, tracking added/updated/deleted/unchanged files."),
    Tool("GetDriveFolderStructure", lambda _: get_drive_folder_structure(service, folder_id),
         "List the current Google Drive folder hierarchy for OHacksMirror."),
    Tool("GetRecentDriveChanges", lambda _: fetch_recent_changes(),
         "Fetch the most recent file events from Supabase."),
    Tool("MoveFileByName", lambda args: move_drive_file_by_name(service, *args.split(",")),
         "Move a file by name into a specified folder. Input: 'file_name,destination_folder'."),
    Tool("FindFileInDrive", lambda q: find_file_in_drive(service, folder_id, q),
         "Search Google Drive recursively for a file by name and return its folder path.")
]

memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
agent = initialize_agent(tools, llm,
                         agent=AgentType.CONVERSATIONAL_REACT_DESCRIPTION,
                         memory=memory, verbose=True,
                         handle_parsing_errors=True)
