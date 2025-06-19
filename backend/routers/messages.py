from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from storage.database import supabase, get_current_user
from models.message import MessageCreate, MessageResponse, MessageUpdate
from models.user import User
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/messages", tags=["messages"])

@router.get("/chat/{chat_id}", response_model=List[MessageResponse])
async def get_messages(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    limit: Optional[int] = 50,
    offset: Optional[int] = 0
):
    """Get all messages for a specific chat"""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service not configured")
        
    try:
        # First verify user has access to this chat
        chat_response = supabase.table("chats").select("id").eq("id", chat_id).eq("user_id", current_user.id).execute()
        
        if not chat_response.data:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Get messages
        response = supabase.table("messages").select("*").eq("chat_id", chat_id).order("created_at", desc=False).range(offset, offset + limit - 1).execute()
        
        return response.data
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat/{chat_id}", response_model=MessageResponse)
async def create_message(
    chat_id: str,
    message: MessageCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new message in a chat"""
    try:
        # First verify user has access to this chat
        chat_response = supabase.table("chats").select("id").eq("id", chat_id).eq("user_id", current_user.id).execute()
        
        if not chat_response.data:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Create message
        message_data = {
            "id": str(uuid.uuid4()),
            "chat_id": chat_id,
            "role": message.role,
            "content": message.content,
            "metadata": message.metadata,
            "created_at": datetime.utcnow().isoformat()
        }
        
        response = supabase.table("messages").insert(message_data).execute()
        
        # Update chat's updated_at timestamp
        supabase.table("chats").update({
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", chat_id).execute()
        
        return response.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific message"""
    try:
        # Get message and verify user has access to the chat
        response = supabase.table("messages").select("*, chats!inner(user_id)").eq("id", message_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Message not found")
            
        message = response.data[0]
        
        # Check if user owns the chat
        if message["chats"]["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
            
        # Remove the nested chats data
        del message["chats"]
        return message
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: str,
    message: MessageUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a message"""
    try:
        # Get message and verify user has access to the chat
        response = supabase.table("messages").select("*, chats!inner(user_id)").eq("id", message_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Message not found")
            
        existing_message = response.data[0]
        
        # Check if user owns the chat
        if existing_message["chats"]["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Update message
        update_data = {"updated_at": datetime.utcnow().isoformat()}
        if message.content is not None:
            update_data["content"] = message.content
        if message.metadata is not None:
            update_data["metadata"] = message.metadata
        
        response = supabase.table("messages").update(update_data).eq("id", message_id).execute()
        
        return response.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a message"""
    try:
        # Get message and verify user has access to the chat
        response = supabase.table("messages").select("*, chats!inner(user_id)").eq("id", message_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Message not found")
            
        message = response.data[0]
        
        # Check if user owns the chat
        if message["chats"]["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Delete message
        supabase.table("messages").delete().eq("id", message_id).execute()
        
        return {"message": "Message deleted successfully"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
