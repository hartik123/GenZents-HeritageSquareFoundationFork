from storage.database import supabase
import asyncio
from services.generative_ai import generate_text
from utils.sanitize import remove_null_chars


def get_file_metadata_table():
    """
    Fetches all file metadata records from Supabase.
    Returns:
        List[dict]: List of file metadata records.
    """
    try:
        if not supabase:
            print("Supabase client not initialized.")
            return []
        response = supabase.table("file_metadata").select("*").execute()
        data = response.data if hasattr(response, 'data') else response.get('data', [])
        if not data:
            return []
        # Optionally, map keys to camelCase if needed
        return data
    except Exception as e:
        print(f"Error fetching file metadata: {e}")
        return []

def suggest_folder_structure_with_gemini(user_prompt: str = "Suggest a folder structure for my drive based on my files."):
    """
    Suggests a folder/files/nested structure for the drive using Gemini, file metadata, and ChromaDB as a knowledge base (not prompt context).
    Args:
        user_prompt (str): The user's prompt or requirements for the structure.
    Returns:
        dict: Consistent format with suggested structure and status.
    """
    file_metadata = get_file_metadata_table()
    if not file_metadata:
        return {"status": "error", "message": "No file metadata found.", "structure": None}
    # Instead of passing ChromaDB context in prompt, we reference it as a knowledge base for Gemini (conceptual, as Gemini API does not support direct RAG yet)
    # If Gemini API supports RAG, you would pass a retriever or knowledge base handle. For now, we just mention it in the prompt for best-effort.
    context = "File Metadata (for reference):\n"
    for file in file_metadata:
        context += (
            f"- file_name: {file.get('file_name')}"
            f", file_type: {'folder' if file.get('file_type') else 'file'}"
            f", file_path: {file.get('file_path')}"
            f", summary: {file.get('summary', '')}"
            f", tags: {', '.join(file.get('tags', []))}\n"
        )
    prompt = f"""
{user_prompt}\n
Here is a list of files and their metadata from my Google Drive. Suggest an efficient, organized folder structure (including nested folders if needed) that groups files by type, topic, or other logical categories.\n
For each folder and subfolder, provide:\n- file_name (string)\n- file_type (boolean, true for folder, false for file)\n- file_path (string, full path from root)\n- summary (string, a short description of the folder's purpose and how things are organized in it)\n- tags (array of keywords)\n+Output the structure as a JSON array of objects, one for each folder/subfolder.\n+You have access to a knowledge base (ChromaDB) for additional context if needed.\n
{context}\n
Respond ONLY with the JSON array, no extra explanation.\n"""
    suggestion = generate_text(prompt)
    import json
    structure = None
    try:
        structure = json.loads(suggestion)
    except Exception:
        structure = suggestion
    return {"status": "success", "structure": structure}

# TODO: Check later
def organize_drive_by_gemini(service, root_folder_id, user_prompt: str, supabase_client):
    """
    Organizes Google Drive folders according to Gemini's suggested structure. Only folders/subfolders are created/updated. File names/content are not changed.
    Updates Supabase file_metadata table for new folders and updates/deletes previous entries as needed.
    Args:
        service: Google Drive API service instance.
        root_folder_id: The root folder ID.
        user_prompt: User's requirements for the structure.
        supabase_client: Supabase client for metadata updates.
    Returns:
        dict: Status and structure summary.
    """
    result = suggest_folder_structure_with_gemini(user_prompt)
    if result["status"] != "success" or not result["structure"]:
        return result
    structure = result["structure"]
    # structure is expected to be a list of folder objects as per schema
    created = []
    from datetime import datetime
    for folder in structure:
        if not folder.get("file_type", True):
            continue  # Only create folders, not files
        folder_name = folder.get("file_name")
        folder_path = folder.get("file_path")
        summary = folder.get("summary", "")
        tags = folder.get("tags", [])
        # Determine parent_id from file_path
        parent_id = root_folder_id
        if folder_path and "/" in folder_path:
            parent_parts = folder_path.strip("/").split("/")[:-1]
            curr_parent = root_folder_id
            for part in parent_parts:
                results = service.files().list(
                    q=f"mimeType='application/vnd.google-apps.folder' and name='{part}' and '{curr_parent}' in parents and trashed=false",
                    fields="files(id, name)"
                ).execute()
                folders = results.get("files", [])
                if folders:
                    curr_parent = folders[0]['id']
                else:
                    folder_obj = service.files().create(body={
                        'name': part,
                        'mimeType': 'application/vnd.google-apps.folder',
                        'parents': [curr_parent]
                    }, fields="id, name").execute()
                    curr_parent = folder_obj['id']
            parent_id = curr_parent
        # Check if folder exists
        results = service.files().list(
            q=f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}' and '{parent_id}' in parents and trashed=false",
            fields="files(id, name)"
        ).execute()
        folders = results.get("files", [])
        if folders:
            folder_id = folders[0]['id']
        else:
            folder_obj = service.files().create(body={
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_id]
            }, fields="id, name").execute()
            folder_id = folder_obj['id']
        # Remove previous entry if exists
        supabase_client.table("file_metadata").delete().eq("file_name", folder_name).eq("file_type", True).eq("file_path", folder_path).execute()
        # Insert new entry with sanitization
        supabase_client.table("file_metadata").insert(remove_null_chars({
            "file_type": True,
            "file_name": folder_name,
            "file_path": folder_path,
            "summary": summary,
            "tags": tags,
            "updated_at": datetime.utcnow().isoformat()
        })).execute()
        created.append({"file_name": folder_name, "id": folder_id, "file_path": folder_path, "summary": summary, "tags": tags})
    return {"status": "applied", "structure": structure, "created_folders": created}
    