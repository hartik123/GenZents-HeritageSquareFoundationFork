import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Service key for backend writes

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def log_file_event(file_id, file_name, parent_folder=None, modified_time=None, size_mb=0, action="unknown"):
    """
    Logs a Drive file change event into Supabase.
    Stores the parent folder, size, and type of change (added/updated/deleted/etc.).
    """
    try:
        supabase.table("file_metadata").upsert({
            "file_id": file_id,
            "file_name": file_name,
            "parent_folder": parent_folder or "root",
            "modified_time": modified_time or "",
            "size_mb": size_mb or 0,
            "last_action": action
        }).execute()
        print(f"📝 Logged to Supabase: {action.upper()} - {file_name}")
    except Exception as e:
        print(f"⚠️ Failed to log to Supabase: {e}")

def fetch_recent_changes(limit=10):
    """
    Fetches the most recent file events from file_metadata.
    """
    try:
        result = (
            supabase.table("file_metadata")
            .select("*")
            .order("modified_time", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data
    except Exception as e:
        print(f"⚠️ Failed to fetch from Supabase: {e}")
        return []