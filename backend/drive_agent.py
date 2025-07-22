# This is a backup of the recent version of drive_agent.py
import os
import pickle
import gradio as gr
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from scan_and_embed_drive import scan_folder_and_embed
from dotenv import load_dotenv
from services.search_drive import search_drive_documents
from services.generate_answer_with_llm import generate_answer_with_llm
from services.move_drive_file import move_drive_file
from services.summarize_drive_file import handle_summarize_request
from services.upload_local_file_to_drive import upload_local_file_to_drive
from services.create_standard_folder_structure import create_standard_folder_structure
from services.organize_existing_drive_files import organize_existing_drive_files
from services.sync_checker import sync_drive_with_chroma
import re
import tkinter as tk
from tkinter import filedialog
import mimetypes
from googleapiclient.http import MediaFileUpload
load_dotenv()

SCOPES = ['https://www.googleapis.com/auth/drive']

CREDENTIALS_FILE = 'client_secret_634158695245-ncmbo57t3e61ubjfoqaa7c422tpdnoti.apps.googleusercontent.com.json'


def authenticate():
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

def get_folder_id(service, folder_name):
    results = service.files().list(
        q=f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}' and trashed=false",
        spaces='drive',
        fields="files(id, name)",
    ).execute()
    folders = results.get('files', [])
    if not folders:
        raise Exception(f"No folder found with name '{folder_name}'")
    return folders[0]['id']

def list_files_in_folder(service, folder_id):
    query = f"'{folder_id}' in parents and trashed=false"
    results = service.files().list(
        q=query,
        fields="files(id, name, mimeType)"
    ).execute()
    files = results.get('files', [])
    print("\nFiles in folder:")
    for file in files:
        print(f"- {file['name']} ({file['mimeType']})")

def pick_file():
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename()
    root.destroy()
    return file_path

def get_folder_name(service, folder_id):
    folder = service.files().get(fileId=folder_id, fields="name").execute()
    return folder.get("name", "unknown")


if __name__ == '__main__':
    service = authenticate()
    folder_name = 'OHacksMirror'
    folder_id = get_folder_id(service, folder_name)
    list_files_in_folder(service, folder_id)

    folder_map = create_standard_folder_structure(service, folder_id)
    print("\nFolder Map (Name → ID):", folder_map)

    summary = organize_existing_drive_files(service, folder_id, folder_map)
    print("\nOrganization Summary:", summary)

    # Embed the folder contents once at startup
    scan_folder_and_embed(service, folder_name)

    from scan_and_embed_drive import test_chroma_metadata
    test_chroma_metadata()

    print("\n🔍 Ask your Drive anything (type 'exit' to quit, or 'help' for commands):")
    while True:
        query = input("\nYou: ").strip().lower()

        if query in ["exit", "quit"]:
            print("👋 Exiting agent. Bye!")
            break

        if query == "help":
            print("\nCommands you can use:")
            print("- Ask any question about your Drive (e.g., 'What is PF03?').")
            print("- Type 'move' to move a file to another folder.")
            print("- Type 'upload' to upload a local file to your Drive.")
            print("- Type 'metadata' to list file metadata.")
            print("- Type 'sync' to synchronize ChromaDB with Google Drive.")
            print("- Type 'find <name>' to search for files by name (fuzzy match).")
            print("- Type 'where <name>' to find which folder a file is in.")
            print("- Type 'organize' to analyze and clean up your Drive structure.")
            continue

        if query.startswith("find "):
            from scan_and_embed_drive import query_drive_metadata
            file_name = query[5:].strip().lower()
            results = query_drive_metadata()
            matches = [meta for meta in results if file_name in meta['file_name'].lower()]
            if matches:
                for meta in matches:
                    folder_name = get_folder_name(service, meta['parent_folder'])
                    print(f"✅ File '{meta['file_name']}' exists in your Drive (folder: {folder_name})")
            else:
                print(f"❌ No file matching '{file_name}' found in your Drive.")
            continue

        if query.startswith("where "):
            from scan_and_embed_drive import query_drive_metadata
            file_name = query[6:].strip().lower()
            results = query_drive_metadata()
            matches = [meta for meta in results if file_name in meta['file_name'].lower()]
            if matches:
                for meta in matches:
                    print(f"📁 File '{meta['file_name']}' is in folder (ID): {meta['parent_folder']}")
            else:
                print(f"❌ No file matching '{file_name}' found in your Drive.")
            continue

        if query == "organize":
            from services.organize_existing_drive_files import organize_existing_drive_files
            print("Analyzing current Drive structure...")
            summary = organize_existing_drive_files(service, folder_id, folder_map)
            print("\nOrganization Summary (suggested moves):")
            print(summary)
            confirm = input("Do you want to apply this organization? (y/n): ").strip().lower()
            if confirm == "y":
                # Actually move/rename files and folders
                # (Assume organize_existing_drive_files does this if confirmed)
                print("Organizing files and folders...")
                organize_existing_drive_files(service, folder_id, folder_map, apply_changes=True)
                print("Organization complete. Syncing ChromaDB...")
                from services.sync_checker import sync_drive_with_chroma
                sync_drive_with_chroma(service, folder_id)
                print("ChromaDB updated.")
            else:
                print("No changes made.")
            continue

        if query == "move":
            file_name = input("Enter the EXACT name of the file you want to move: ").strip()
            file_results = service.files().list(
                q=f"name='{file_name}' and mimeType!='application/vnd.google-apps.folder' and trashed=false",
                spaces='drive',
                fields="files(id, name)"
            ).execute()
            matched_files = file_results.get("files", [])
            if not matched_files:
                print(f"❌ No file found with name '{file_name}'")
            else:
                file_id = matched_files[0]['id']
                print(f"✅ Found file: {matched_files[0]['name']} (ID: {file_id})")
                destination = input("Enter the name of the folder to move it to: ").strip()
                result = move_drive_file(service, file_id, destination)
                print(result)
            continue

        if query == "upload":
            from services.upload_local_file_to_drive import upload_local_file_to_drive
            subfolder = input("Enter the subfolder inside OHacksMirror to upload into (or leave blank for root): ").strip()
            parent_id = folder_id  # OHacksMirror root by default

            if subfolder:
                results = service.files().list(
                    q=f"mimeType='application/vnd.google-apps.folder' and name='{subfolder}' and '{folder_id}' in parents and trashed=false",
                    spaces='drive',
                    fields="files(id, name)"
                ).execute()
                folders = results.get("files", [])
                if folders:
                    parent_id = folders[0]['id']
                else:
                    print(f"❌ Subfolder '{subfolder}' not found. Uploading to OHacksMirror root.")

            # GUI picker or manual input
            try:
                from tkinter import Tk, filedialog
                def pick_file():
                    root = Tk()
                    root.withdraw()
                    return filedialog.askopenfilename()
            except ImportError:
                pick_file = None  # fallback if GUI not available

            use_gui = input("Do you want to use a file picker GUI? (y/n): ")
            if use_gui.lower() == "y" and pick_file:
                filepath = pick_file()
                if not filepath:
                    print("❌ No file selected.")
                    continue
            else:
                filepath = input("Enter the path to the local file you want to upload: ").strip()

            response = upload_local_file_to_drive(filepath, service, parent_id)
            print(response)
            continue

        if query == "sync":
            from services.sync_checker import sync_drive_with_chroma
            sync_drive_with_chroma(service, folder_id)
            continue

        if query == "metadata":
            from scan_and_embed_drive import query_drive_metadata
            results = query_drive_metadata()
            print("\n📄 File Metadata:")
            for meta in results:
                folder_name = get_folder_name(service, meta['parent_folder'])
                print(f"- {meta['file_name']} | Modified: {meta['modified_time']} | Size: {meta['size_mb']} MB | Folder: {folder_name}")
            continue

        # Default: Treat as a query for the AI agent
        chunks = search_drive_documents(query)
        answer = generate_answer_with_llm(query, chunks)
        print("\n🤖 Agent:\n", answer)