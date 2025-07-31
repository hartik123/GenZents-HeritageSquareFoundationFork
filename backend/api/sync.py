from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from storage.database import get_current_user, get_user_supabase_client
from services.drive_agent import create_drive_agent
from scripts.google_drive import GoogleDriveService
from scripts.chroma import embed_pdf_chunks, remove_file as chroma_remove_file
from services.generative_ai import generate_text
from services.additional_tools import get_file_metadata_table
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/sync", tags=["sync"])
security = HTTPBearer()

def get_authenticated_supabase(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        return get_user_supabase_client(credentials.credentials)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to authenticate with database")

@router.post("/drive")
async def sync_drive(
    current_user=Depends(get_current_user),
    user_supabase=Depends(get_authenticated_supabase)
):
    """Sync Google Drive with ChromaDB and Supabase file_metadata."""
    drive_service = GoogleDriveService()
    # 1. List all files in Drive
    all_drive_files = drive_service.list_files()
    drive_files_map = {f['id']: f for f in all_drive_files if f['mimeType'] != 'application/vnd.google-apps.folder'}
    # 2. Get all file_metadata from Supabase
    supabase_files = user_supabase.table("file_metadata").select("*").execute().data or []
    supabase_files_map = {f['id']: f for f in supabase_files}
    changes = []
    now = datetime.utcnow().isoformat()
    # 3. Compare and sync
    for file_id, drive_file in drive_files_map.items():
        meta = supabase_files_map.get(file_id)
        drive_mtime = drive_file.get('modifiedTime') or drive_file.get('modified_time')
        # If new or updated
        if not meta or (meta and drive_mtime and drive_mtime > (meta.get('updated_at') or '')):
            # Download and embed in Chroma
            if drive_file['mimeType'] == 'application/pdf':
                from scripts.drive_sync import download_pdf_text
                text = download_pdf_text(drive_service, file_id)
                embed_pdf_chunks(text, file_id, drive_file['name'], drive_mtime, float(drive_file.get('size', 0)) / (1024*1024), drive_file.get('parents', [''])[0])
            # Use Gemini to rewrite summary/tags if needed
            summary = meta['summary'] if meta and meta.get('summary') else None
            tags = meta['tags'] if meta and meta.get('tags') else []
            if not summary or not tags:
                prompt = f"Summarize and tag the following file for a knowledge base.\nFile name: {drive_file['name']}\nContent: {text[:2000]}"
                ai_result = generate_text(prompt)
                summary = ai_result[:200] if ai_result else ""
                tags = [t.strip() for t in ai_result.split() if len(t.strip()) > 2][:5]
            # Upsert into Supabase
            upsert_data = {
                "id": file_id,
                "file_type": True if drive_file['mimeType'] == 'application/pdf' else False,
                "file_name": drive_file['name'],
                "file_path": f"drive://{file_id}",
                "summary": summary,
                "tags": tags,
                "updated_at": drive_mtime or now
            }
            user_supabase.table("file_metadata").upsert(upsert_data).execute()
            changes.append({"type": "added" if not meta else "modified", "file_id": file_id, "file_name": drive_file['name']})
        else:
            # No change
            continue
    # 4. Remove deleted files from Chroma and Supabase
    for file_id, meta in supabase_files_map.items():
        if file_id not in drive_files_map:
            chroma_remove_file(file_id)
            user_supabase.table("file_metadata").delete().eq("id", file_id).execute()
            changes.append({"type": "deleted", "file_id": file_id, "file_name": meta['file_name']})
    # 5. Create version and change entries only if there are changes
    if not changes:
        return {"status": "no_changes", "changes": []}
    version_data = {
        "version": f"v{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
        "title": "Drive Sync",
        "description": f"Drive sync performed at {now}",
        "user_id": current_user.id,
        "timestamp": now,
        "status": "current",
        "data": {"changes": changes}
    }
    version_resp = user_supabase.table("versions").insert(version_data).execute()
    version_id = version_resp.data[0]["id"] if version_resp.data and isinstance(version_resp.data, list) else str(uuid.uuid4())
    for change in changes:
        change_data = {
            "version_id": version_id,
            "type": change["type"],
            "original_path": change["file_id"],
            "new_path": None,
            "original_value": None,
            "new_value": None,
            "description": f"{change['type']} file {change['file_name']}",
            "user_id": current_user.id,
            "timestamp": now
        }
        user_supabase.table("changes").insert(change_data).execute()
    return {"status": "success", "changes": changes, "version_id": version_id}
