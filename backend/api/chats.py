from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from storage.database import supabase, get_current_user
from models.chat import ChatCreate, ChatResponse, ChatUpdate
from models.user import User
from utils.logger import logger
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/chats", tags=["chats"])


@router.get("/", response_model=List[ChatResponse])
async def get_chats(
    current_user: User = Depends(get_current_user),
    archived: Optional[bool] = None,
    bookmarked: Optional[bool] = None
):
    """Get all chats for the current user"""
    if not supabase:
        raise HTTPException(
            status_code=503, detail="Database service not configured")

    try:
        query = supabase.table("chats").select(
            "*").eq("user_id", current_user.id)

        if archived is not None:
            query = query.eq("archived", archived)
        if bookmarked is not None:
            query = query.eq("bookmarked", bookmarked)

        response = query.order("updated_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=ChatResponse)
async def create_chat(
    chat: ChatCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new chat"""
    if not supabase:
        raise HTTPException(
            status_code=503, detail="Database service not configured")

    try:
        chat_data = {
            "id": str(uuid.uuid4()),
            "title": chat.title,
            "user_id": current_user.id,
            "model": chat.model,
            "system_prompt": chat.system_prompt,
            "tags": chat.tags or [],
            "bookmarked": False,
            "archived": False,
            "shared": False,
            "version": 1,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()}

        response = supabase.table("chats").insert(chat_data).execute()
        return response.data[0]
    except Exception as e:
        logger.error(f"Error creating chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific chat"""
    try:
        response = supabase.table("chats").select(
            "*").eq("id", chat_id).eq("user_id", current_user.id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Chat not found")

        return response.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{chat_id}", response_model=ChatResponse)
async def update_chat(
    chat_id: str,
    chat: ChatUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a chat"""
    try:
        update_data = {}
        if chat.title is not None:
            update_data["title"] = chat.title
        if chat.model is not None:
            update_data["model"] = chat.model
        if chat.system_prompt is not None:
            update_data["system_prompt"] = chat.system_prompt
        if chat.tags is not None:
            update_data["tags"] = chat.tags

        update_data["updated_at"] = datetime.utcnow().isoformat()

        response = supabase.table("chats").update(update_data).eq(
            "id", chat_id).eq("user_id", current_user.id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Chat not found")

        return response.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a chat"""
    try:
        # First delete all messages in the chat
        supabase.table("messages").delete().eq("chat_id", chat_id).execute()

        # Then delete the chat
        response = supabase.table("chats").delete().eq(
            "id", chat_id).eq("user_id", current_user.id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Chat not found")

        return {"message": "Chat deleted successfully"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
