from utils.sanitize import remove_null_chars
from fastapi import APIRouter, HTTPException, Depends, status
from utils.logger import logger
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from storage.database import get_current_user, get_user_supabase_client
from scripts.google_drive import GoogleDriveService
from scripts.chroma import embed_pdf_chunks, remove_file as chroma_remove_file
from datetime import datetime
from services.generative_ai import generate_text
from utils.sanitize import extract_json_from_string
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
    # Recursively list all files and folders starting from root
    all_drive_items = drive_service.list_all_items()
    drive_items_map = {f['id']: f for f in all_drive_items}
    # Build full path for each item
    def build_full_path(item_id):
        parts = []
        current = drive_items_map.get(item_id)
        while current:
            parts.insert(0, current['name'])
            parents = current.get('parents', [])
            if not parents or parents[0] == 'root':
                break
            current = drive_items_map.get(parents[0])
        return '/' + '/'.join(parts)
    # 2. Get all file_metadata from Supabase
    supabase_files = user_supabase.table("file_metadata").select("*").execute().data or []
    logger.info(f"Supabase file_metadata rows: {len(supabase_files)}")
    supabase_files_map = {f['id']: f for f in supabase_files}
    changes = []
    now = datetime.utcnow().isoformat()
    gemini_cache = {}
    # 3. Bottom-up sync: process files first, then folders
    logger.info("Starting bottom-up sync...")
    # 3a. Process files (non-folders)
    for item_id, drive_item in drive_items_map.items():
        if drive_item['mimeType'] == 'application/vnd.google-apps.folder':
            continue
        logger.info(f"Processing file item_id: {item_id}, name: {drive_item.get('name')}")
        meta = supabase_files_map.get(item_id)
        drive_mtime = drive_item.get('modifiedTime') or drive_item.get('modified_time')
        file_path = build_full_path(item_id)
        changed = False
        if not meta:
            changed = True
        else:
            meta_parent = meta.get('file_path', '').rsplit('/', 1)[0] if meta.get('file_path') else ''
            drive_parent = file_path.rsplit('/', 1)[0]
            if (
                meta.get('file_name') != drive_item['name'] or
                meta_parent != drive_parent or
                (meta.get('updated_at') or '') != (drive_mtime or '') or
                str(meta.get('tags', '')) != str(meta.get('tags', '')) or
                meta.get('summary', '') != meta.get('summary', '') or
                meta.get('file_path', '') != file_path or
                (meta.get('size', None) != drive_item.get('size', None))
            ):
                changed = True
        if changed:
            summary = meta['summary'] if meta and meta.get('summary') else None
            tags = meta['tags'] if meta and meta.get('tags') else []
            chroma_tags = ', '.join(tags) if isinstance(tags, list) else (tags or '')
            text = None
            cache_key = f"file:{item_id}"
            parsed = gemini_cache.get(cache_key)
            if not summary or not tags:
                if parsed is None:
                    prompt = (
                        f"Given the following file, generate a short summary describing its content and significance, and suggest 3-5 relevant tags. "
                        f"Return the result as a JSON object with keys 'summary' (string, max 200 chars) and 'tags' (array of strings, 3-5 items).\n"
                        f"File Name: {drive_item['name']}\n"
                    )
                    if text:
                        prompt += f"File Content (truncated):\n{text[:2000]}"
                    ai_result = generate_text(prompt)
                    parsed = extract_json_from_string(ai_result)
                    gemini_cache[cache_key] = parsed or {}
                if parsed:
                    summary = parsed.get('summary', f"No summary available for {drive_item['name']}")
                    tags = parsed.get('tags', [])
                else:
                    summary = f"No summary available for {drive_item['name']}"
                    tags = []
            if drive_item['mimeType'] == 'application/pdf':
                text = drive_service.download_file(item_id)
                embed_pdf_chunks(
                    text,
                    item_id,
                    drive_item['name'],
                    drive_mtime,
                    float(drive_item.get('size', 0)) / (1024*1024),
                    drive_item.get('parents', [''])[0],
                    chroma_tags,
                    summary,
                )
            upsert_data = {
                "id": item_id,
                "file_type": True,
                "file_name": drive_item['name'],
                "file_path": file_path,
                "summary": summary,
                "tags": tags,
                "updated_at": drive_mtime or now,
            }
            logger.info(f"Upserting file into Supabase: {upsert_data}")
            user_supabase.table("file_metadata").upsert(remove_null_chars(upsert_data)).execute()
            changes.append({"type": "added" if not meta else "modified", "file_id": item_id, "file_name": drive_item['name']})
    # 3b. Process folders bottom-up (children before parents)
    # Sort folders by depth (deepest first)
    folders = [item for item in all_drive_items if item['mimeType'] == 'application/vnd.google-apps.folder']
    def get_depth(item):
        depth = 0
        current = item
        while current.get('parents') and len(current['parents']) > 0:
            parent_id = current['parents'][0]
            parent = drive_items_map.get(parent_id)
            if not parent or parent['mimeType'] != 'application/vnd.google-apps.folder':
                break
            depth += 1
            current = parent
        return depth
    folders_sorted = sorted(folders, key=get_depth, reverse=True)
    for folder in folders_sorted:
        item_id = folder['id']
        logger.info(f"Processing folder item_id: {item_id}, name: {folder.get('name')}")
        meta = supabase_files_map.get(item_id)
        drive_mtime = folder.get('modifiedTime') or folder.get('modified_time')
        folder_path = build_full_path(item_id)
        changed = False
        if not meta:
            changed = True
        else:
            meta_parent = meta.get('file_path', '').rsplit('/', 1)[0] if meta.get('file_path') else ''
            drive_parent = folder_path.rsplit('/', 1)[0]
            if (
                meta.get('file_name') != folder['name'] or
                meta_parent != drive_parent or
                (meta.get('updated_at') or '') != (drive_mtime or '') or
                meta.get('file_path', '') != folder_path
            ):
                changed = True
        if changed:
            contained_files = [
                f for f in all_drive_items
                if f.get('parents') and len(f['parents']) > 0 and f['parents'][0] == item_id and f['mimeType'] != 'application/vnd.google-apps.folder'
            ]
            contained_summaries = []
            for f in contained_files:
                meta_f = supabase_files_map.get(f['id'])
                summary_val = None
                if meta_f and meta_f.get('summary'):
                    summary_val = meta_f['summary']
                else:
                    cache_key_f = f"file:{f['id']}"
                    parsed_f = gemini_cache.get(cache_key_f)
                    if parsed_f and parsed_f.get('summary'):
                        summary_val = parsed_f['summary']
                if summary_val:
                    contained_summaries.append(f"- {f['name']}: {summary_val}")
            folder_context = "\n".join(contained_summaries)
            cache_key = f"folder:{item_id}"
            parsed = gemini_cache.get(cache_key)
            if parsed is None:
                prompt = (
                    f"Given the following folder and its files, generate a short summary describing the folder's purpose, structure, and significance, and suggest 3-5 relevant tags. "
                    f"Return the result as a JSON object with keys 'summary' (string, max 200 chars) and 'tags' (array of strings, 3-5 items).\n"
                    f"Folder Name: {folder['name']}\nFiles and summaries:\n{folder_context}"
                )
                ai_result = generate_text(prompt)
                parsed = extract_json_from_string(ai_result)
                gemini_cache[cache_key] = parsed or {}
            if parsed:
                summary = parsed.get('summary', "")
                tags = parsed.get('tags', [])
            else:
                summary = ""
                tags = []
            upsert_data = {
                "id": item_id,
                "file_type": False,
                "file_name": folder['name'],
                "file_path": folder_path,
                "summary": summary,
                "tags": tags,
                "updated_at": drive_mtime or now
            }
            user_supabase.table("file_metadata").upsert(remove_null_chars(upsert_data)).execute()
            changes.append({"type": "added" if not meta else "modified", "file_id": item_id, "file_name": folder['name']})
    # 4. Remove deleted files from Chroma and Supabase
    for file_id, meta in supabase_files_map.items():
        if file_id not in drive_items_map:
            chroma_remove_file(file_id)
            delete_result = user_supabase.table("file_metadata").delete().eq("id", file_id).execute()
            logger.info(f"Delete result: {delete_result}")
            changes.append({"type": "deleted", "file_id": file_id, "file_name": meta['file_name']})
    # 5. Create version and change entries only if there are changes
    if not changes:
        return {"status": "no changes", "changes": []}
    version_data = {
        "version": f"v{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
        "title": "Drive Sync",
        "description": f"Drive sync performed at {now}",
        "user_id": current_user.id,
        "timestamp": now,
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
