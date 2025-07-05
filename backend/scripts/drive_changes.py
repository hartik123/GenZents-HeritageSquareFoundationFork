
from supabase import create_client
import openai
import json
import os
from googleapiclient.discovery import build
from dotenv import load_dotenv
load_dotenv()

supabase = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY"))

def get_all_folders_from_supabase():
    result = supabase.table("drive_folders").select("drive_folder_id, path, content").execute()
    return result.data

def list_new_root_files(service):
    query = "'root' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
    response = service.files().list(q=query, fields="files(id, name, mimeType)").execute()
    return response.get("files", [])

def get_file_path_from_llm(file, content, folders):
    prompt = f"""
A new file has been uploaded to the root of a Google Drive:
File: {file['name']}
Content: {content[:1000]}

Here are summaries of existing folders:
{json.dumps(folders, indent=2)}

Based on this, return JSON like the sample:
{{
  "action": "move",
  "target_folder_path": "./history/american_history",
  "reason": "It matches American history."
}}
"""

    response = openai.ChatCompletion.create(
        model="gemini-1.5-flash",
        messages=[{"role": "user", "content": prompt}]
    )
    return json.loads(response["choices"][0]["message"]["content"])

def get_or_create_folder_by_path(service, path: str):
    parts = path.strip("./").split("/")
    parent_id = "root"
    for name in parts:
        query = f"name = '{name}' and mimeType = 'application/vnd.google-apps.folder' and '{parent_id}' in parents"
        res = service.files().list(q=query, fields="files(id, name)").execute()
        folder = res.get("files", [])
        if folder:
            parent_id = folder[0]["id"]
        else:
            new_folder = service.files().create(body={
                "name": name,
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [parent_id]
            }, fields="id").execute()
            parent_id = new_folder["id"]
    return parent_id

def move_file(service, file_id: str, target_folder_id: str):
    file = service.files().get(fileId=file_id, fields="parents").execute()
    previous_parents = ",".join(file.get("parents", []))
    service.files().update(
        fileId=file_id,
        addParents=target_folder_id,
        removeParents=previous_parents,
        fields="id, parents"
    ).execute()


async def google_changes_handler(drive_service): 
    new_files = list_new_root_files(drive_service)

    if not new_files:
        return {"status": "no new files"}

    folders = get_all_folders_from_supabase()

    for file in new_files:
        content = drive_service.extract_file_content(file)
        decision = get_file_path_from_llm(file, content, folders)
        print(decision)

        if decision["action"] == "move":
            folder_id = get_or_create_folder_by_path(drive_service, decision["target_folder_path"])
            move_file(drive_service, file["id"], folder_id)

    return {"status": "organized"}