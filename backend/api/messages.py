from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from storage.database import supabase, get_current_user, get_user_supabase_client
from models.message import MessageCreate, MessageResponse, MessageUpdate
from models.user import User
from utils.logger import logger
from scripts.context_manager import create_prompt
from utils.user_security import get_security_service
import uuid
import json
from datetime import datetime

router = APIRouter(prefix="/api/messages", tags=["messages"])
security = HTTPBearer()


def get_authenticated_supabase(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get Supabase client authenticated with user's token"""
    try:
        return get_user_supabase_client(credentials.credentials)
    except Exception as e:
        logger.error(f"Failed to create authenticated Supabase client: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to authenticate with database"
        )

@router.post("/chat/{chat_id}", response_model=MessageResponse)
async def create_message(
    chat_id: str,
    message: MessageCreate,
    current_user: User = Depends(get_current_user),
    user_supabase=Depends(get_authenticated_supabase)
):
    try:
        start_time = datetime.utcnow()
        chat_response = user_supabase.table("chats").select("id").eq("id", chat_id).eq("user_id", current_user.id).execute()
        if not chat_response.data:
            raise HTTPException(status_code=404, detail="Chat not found")
        if message.role != 'user':
            raise HTTPException(status_code=400, detail="Only user messages can be created through this endpoint.")
        security_service = get_security_service(user_supabase)
        user_constraints = await security_service.get_user_constraints(current_user.id)
        message_check = await security_service.check_user_can_send_message(current_user.id, message.content)
        if not message_check.allowed:
            raise HTTPException(status_code=403, detail=message_check.reason)
        # Use new context_manager prompt
        prompt = await create_prompt(user_supabase, current_user.id, chat_id, message.content)
        from services.drive_agent import create_drive_agent
        agent = create_drive_agent(current_user.id, user_supabase)
        ai_response_text = await agent.process_message(prompt)
        estimated_tokens = (len(message.content) + len(ai_response_text)) // 4
        await security_service.update_user_usage(user_id=current_user.id, tokens_used=estimated_tokens, messages_count=1)
        ai_message_data = {
            "id": str(uuid.uuid4()),
            "chat_id": chat_id,
            "user_id": current_user.id,
            "role": "assistant",
            "content": ai_response_text,
            "context_summary": ai_response_text,
            "created_at": datetime.utcnow().isoformat(),
            "metadata": {
                "model": "gemini-2.0-flash",
                "enhanced_context": True,
                "context_summary_updated": True,
                "tokens_used": estimated_tokens,
                "security_context_applied": True
            }
        }
        response = user_supabase.table("messages").insert(ai_message_data).execute()
        end_time = datetime.utcnow()
        total_original_messages = chat_response.data[0]["metadata"].get("totalMessages", 0)
        user_supabase.table("chats").update(
            {"updated_at": datetime.utcnow().isoformat(),
             "context_summary": ai_message_data["context_summary"],
             "metadata": {
                "totalMessages": total_original_messages + 2,
                "totalTokens": (chat_response.data[0]["metadata"].get("totalTokens") if chat_response.data[0].get("metadata") else 0) + estimated_tokens,
                "averageResponseTime": (
                    total_original_messages * (chat_response.data[0]["metadata"].get("averageResponseTime", 0) if chat_response.data[0].get("metadata") else 0)
                    + 2 * (end_time - start_time).total_seconds()
                ) / (total_original_messages + 2),
             }}
          ).eq("id", chat_id).execute()
        logger.info(f"AI message saved: {ai_message_data['id']}")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating message in chat {chat_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Message creation failed")

# TODO: A placeholder for the message stream endpoint. Not using currently.
@router.post("/chat/{chat_id}/stream")
async def create_message_stream(
    chat_id: str,
    message: MessageCreate,
    current_user: User = Depends(get_current_user),
    user_supabase=Depends(get_authenticated_supabase)
):
    """Create a new message and stream AI response"""
    try:
        logger.info(
            f"""Creating streaming message for chat {chat_id} by user {
                current_user.id}""")

        # ...existing code...

        # Verify user has access to this chat and get chat details
        chat_response = user_supabase.table("chats").select(
            "id, context_summary"
        ).eq("id", chat_id).eq("user_id", current_user.id).execute()

        if not chat_response.data:
            logger.warning(
                f"""Chat {chat_id} not found for user {
                    current_user.id}""")
            raise HTTPException(status_code=404, detail="Chat not found")

        chat_data = chat_response.data[0]

        if message.role != 'user':
            raise HTTPException(
                status_code=400, detail="Only user messages can be created through this endpoint.")


        # Save user's message (original content)
        user_message_data = {
            "id": str(uuid.uuid4()),
            "chat_id": chat_id,
            "role": "user",
            "content": message.content,
            "created_at": datetime.utcnow().isoformat(),
            "metadata": {}
        }
        user_supabase.table("messages").insert(user_message_data).execute()
        logger.info(f"User message saved for streaming: {user_message_data['id']}")

        async def generate_response():
            try:
                prompt = await create_prompt(user_supabase, current_user.id, chat_id, message.content)
                from services.generative_ai import generate_text
                ai_response_text = generate_text(prompt=prompt)
                ai_message_data = {
                    "id": str(uuid.uuid4()),
                    "chat_id": chat_id,
                    "role": "assistant",
                    "content": ai_response_text,
                    "created_at": datetime.utcnow().isoformat(),
                    "metadata": {
                        "model": "gemini-2.0-flash",
                        "enhanced_context": True,
                        "context_summary_updated": True
                    }
                }
                ai_response = user_supabase.table("messages").insert(ai_message_data).execute()
                user_supabase.table("chats").update({"updated_at": datetime.utcnow().isoformat()}).eq("id", chat_id).execute()
                logger.info(f"AI streaming message saved: {ai_message_data['id']}")
                yield f"data: {json.dumps({'type': 'complete', 'message': ai_response.data[0]})}\n\n"
            except Exception as e:
                logger.error(f"Error in streaming response: {str(e)}")
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

        return StreamingResponse(
            generate_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        error_detail = str(e)
        logger.error(
            f"Error creating streaming message in chat {chat_id}: {error_detail}")
        raise HTTPException(
            status_code=500,
            detail=f"Streaming message creation failed: {error_detail}")

# TODO: A placeholder for the message update endpoint. Not using currently.
@router.put("/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: str,
    message: MessageUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a message"""
    try:
        # Get message and verify user has access to the chat
        response = supabase.table("messages").select(
            "*, chats!inner(user_id)").eq("id", message_id).execute()
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
        response = supabase.table("messages").update(
            update_data).eq("id", message_id).execute()
        return response.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
