from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from typing import List, Optional
from storage.database import supabase, get_current_user, get_user_supabase_client
from models.message import MessageCreate, MessageResponse, MessageUpdate
from models.task import TaskCreate, TaskType
from models.user import User
from utils.logger import logger
from services.context_manager import get_context_manager
import uuid
import json
from datetime import datetime
from services.generative_ai import generate_text, generate_text_stream
from backend.utils.command_processor import command_processor

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


@router.get("/chat/{chat_id}", response_model=List[MessageResponse])
async def get_messages(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    user_supabase=Depends(get_authenticated_supabase),
    limit: Optional[int] = 50,
    offset: Optional[int] = 0
):
    """Get all messages for a specific chat"""
    try:
        # Validate pagination parameters
        limit = min(max(1, limit), 100)  # Clamp between 1-100
        offset = max(0, offset)  # Ensure non-negative

        # First verify user has access to this chat
        chat_response = user_supabase.table("chats").select("id").eq(
            "id", chat_id).eq("user_id", current_user.id).execute()

        if not chat_response.data:
            raise HTTPException(status_code=404, detail="Chat not found")

        # Get messages with optimized query
        response = user_supabase.table("messages").select("*").eq("chat_id", chat_id).order(
            "created_at", desc=False).range(offset, offset + limit - 1).execute()

        return response.data
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/{chat_id}", response_model=MessageResponse)
async def create_message(
    chat_id: str,
    message: MessageCreate,
    current_user: User = Depends(get_current_user),
    user_supabase=Depends(get_authenticated_supabase)
):
    """Create a new message in a chat and get a response from the AI"""
    try:
        logger.info(
            f"Creating message for chat {chat_id} by user {
                current_user.id}")

        # 1. Initialize context manager
        context_manager = get_context_manager(user_supabase)
        
        # 2. Verify user has access to this chat and get chat details
        chat_response = user_supabase.table("chats").select(
            "id, system_prompt, context_summary"
        ).eq("id", chat_id).eq("user_id", current_user.id).execute()

        if not chat_response.data:
            logger.warning(
                f"Chat {chat_id} not found for user {
                    current_user.id}")
            raise HTTPException(status_code=404, detail="Chat not found")

        chat_data = chat_response.data[0]
        base_system_prompt = chat_data.get('system_prompt', '')

        if message.role != 'user':
            raise HTTPException(
                status_code=400, detail="Only user messages can be created through this endpoint.")

        # 3. Prepare comprehensive LLM context (includes last 5 messages + user preferences)
        enhanced_system_prompt, message_history, user_preferences = await context_manager.prepare_llm_context(
            user_id=current_user.id,
            chat_id=chat_id,
            user_message=message.content,
            base_system_prompt=base_system_prompt
        )

        # 4. Check for commands in the message
        command_result, remaining_message = command_processor.extract_command_and_message(
            message.content)

        # 4. Check if this is a long-running command that should become a task
        if command_result and command_processor.is_long_running_command(
                message.content):
            # Create a background task instead of processing immediately
            task_type = _determine_task_type_from_command(message.content)

            task_data = {
                "id": str(uuid.uuid4()),
                "user_id": current_user.id,
                "chat_id": chat_id,
                "type": task_type.value,
                "command": message.content,
                "parameters": {},
                "status": "pending",
                "progress": 0,
                "priority": 5,
                "max_retries": 3,
                "retry_count": 0,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }

            # Save the task
            task_response = user_supabase.table(
                "tasks").insert(task_data).execute()
            task_id = task_response.data[0]["id"]

            # Create a message indicating task was created
            task_notification_content = f"🔄 **Long-running task started**\n\nCommand: `{
                message.content}`\nTask ID: `{task_id}`\n\nThis task is running in the background. You can check its progress in the Tasks page."

            task_message_data = {
                "id": str(uuid.uuid4()),
                "chat_id": chat_id,
                "role": "assistant",
                "content": task_notification_content,
                "created_at": datetime.utcnow().isoformat(),
                "metadata": {
                    "is_task_notification": True,
                    "task_id": task_id,
                    "task_type": task_type.value
                }
            }
            user_supabase.table("messages").insert(task_message_data).execute()

            # Update chat timestamp
            user_supabase.table("chats").update({
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", chat_id).execute()

            logger.info(
                f"Created background task {task_id} for command: {
                    message.content}")
            return task_message_data

        # Save user's message (original content)
        user_message_data = {
            "id": str(uuid.uuid4()),
            "chat_id": chat_id,
            "role": "user",
            "content": message.content,
            "created_at": datetime.utcnow().isoformat(),
            "metadata": {"has_commands": command_result is not None} if command_result else None
        }
        user_response = user_supabase.table(
            "messages").insert(user_message_data).execute()
        logger.info(f"User message saved: {user_message_data['id']}")

        # 5. Handle regular commands if present (not long-running)
        if command_result and command_result.success:
            # Save command result as assistant message
            command_content = f"**Command Executed:** {command_result.message}"
            if command_result.suggestions:
                command_content += f"\n\n{
                    chr(10).join(
                        f'• {suggestion}' for suggestion in command_result.suggestions)}"

            command_message_data = {
                "id": str(uuid.uuid4()),
                "chat_id": chat_id,
                "role": "assistant",
                "content": command_content,
                "created_at": datetime.utcnow().isoformat(),
                "metadata": {
                    "is_command_result": True,
                    "command_data": command_result.data
                }
            }
            user_supabase.table("messages").insert(
                command_message_data).execute()
            logger.info(f"Command result saved: {command_message_data['id']}")

            # If no remaining message after commands, return command result
            if not remaining_message:
                user_supabase.table("chats").update({
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", chat_id).execute()
                return command_message_data

        # 5. Generate AI response for remaining message (if any)
        message_for_ai = remaining_message if remaining_message else message.content
        
        # Convert message_history to the format expected by generate_text
        formatted_history = []
        for msg in message_history[:-1]:  # Exclude the current message we just added
            formatted_history.append({
                "role": msg.get("role"),
                "content": msg.get("content")
            })

        ai_response_text = generate_text(
            prompt=message_for_ai,
            history=formatted_history,
            system_prompt=enhanced_system_prompt,
            temperature=user_preferences.get('temperature', 0.7),
            max_tokens=user_preferences.get('max_tokens', 2048)
        )

        # 6. Save AI's response
        ai_message_data = {
            "id": str(uuid.uuid4()),
            "chat_id": chat_id,
            "role": "assistant",
            "content": ai_response_text,
            "created_at": datetime.utcnow().isoformat(),
            "metadata": {
                "model": user_preferences.get('default_model', 'gemini-1.5-flash'),
                "enhanced_context": True,
                "context_summary_updated": True
            }
        }
        response = user_supabase.table(
            "messages").insert(ai_message_data).execute()

        # 7. Update context summary with new conversation
        try:
            await context_manager.update_context_summary(
                chat_id=chat_id,
                recent_messages=message_history[:-1],  # Exclude current user message
                new_ai_response=ai_response_text,
                current_summary=chat_data.get('context_summary', '')
            )
        except Exception as e:
            logger.warning(f"Failed to update context summary for chat {chat_id}: {str(e)}")
            # Don't fail the request if summary update fails

        # 8. Update chat's updated_at timestamp
        user_supabase.table("chats").update({
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", chat_id).execute()

        logger.info(f"AI message saved: {ai_message_data['id']}")
        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating message in chat {chat_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Message creation failed")


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
            f"Creating streaming message for chat {chat_id} by user {
                current_user.id}")

        # Initialize context manager
        context_manager = get_context_manager(user_supabase)
        
        # Verify user has access to this chat and get chat details
        chat_response = user_supabase.table("chats").select(
            "id, system_prompt, context_summary"
        ).eq("id", chat_id).eq("user_id", current_user.id).execute()

        if not chat_response.data:
            logger.warning(
                f"Chat {chat_id} not found for user {
                    current_user.id}")
            raise HTTPException(status_code=404, detail="Chat not found")

        chat_data = chat_response.data[0]
        base_system_prompt = chat_data.get('system_prompt', '')

        if message.role != 'user':
            raise HTTPException(
                status_code=400, detail="Only user messages can be created through this endpoint.")

        # Prepare comprehensive LLM context
        enhanced_system_prompt, message_history, user_preferences = await context_manager.prepare_llm_context(
            user_id=current_user.id,
            chat_id=chat_id,
            user_message=message.content,
            base_system_prompt=base_system_prompt
        )

        # Check for commands in the message
        command_result, remaining_message = command_processor.extract_command_and_message(
            message.content)

        # Save user's message (original content)
        user_message_data = {
            "id": str(uuid.uuid4()),
            "chat_id": chat_id,
            "role": "user",
            "content": message.content,
            "created_at": datetime.utcnow().isoformat(),
            "metadata": {"has_commands": command_result is not None} if command_result else None
        }
        user_supabase.table("messages").insert(user_message_data).execute()
        logger.info(
            f"User message saved for streaming: {
                user_message_data['id']}")

        async def generate_response():
            try:
                # Handle commands first if present
                if command_result and command_result.success:
                    command_content = f"**Command Executed:** {
                        command_result.message}"
                    if command_result.suggestions:
                        command_content += f"\n\n{
                            chr(10).join(
                                f'• {suggestion}' for suggestion in command_result.suggestions)}"

                    # Stream command result
                    yield f"data: {json.dumps({'type': 'command', 'content': command_content})}\n\n"

                    # Save command result
                    command_message_data = {
                        "id": str(uuid.uuid4()),
                        "chat_id": chat_id,
                        "role": "assistant",
                        "content": command_content,
                        "created_at": datetime.utcnow().isoformat(),
                        "metadata": {
                            "is_command_result": True,
                            "command_data": command_result.data
                        }
                    }
                    user_supabase.table("messages").insert(
                        command_message_data).execute()

                    # If no remaining message, end here
                    if not remaining_message:
                        yield f"data: {json.dumps({'type': 'done'})}\n\n"
                        return

                # Generate AI response for remaining message (if any)
                message_for_ai = remaining_message if remaining_message else message.content
                
                # Convert message_history to the format expected by generate_text_stream
                formatted_history = []
                for msg in message_history[:-1]:  # Exclude the current message we just added
                    formatted_history.append({
                        "role": msg.get("role"),
                        "content": msg.get("content")
                    })

                # Stream the AI response
                full_response = ""
                async for chunk in generate_text_stream(
                    prompt=message_for_ai,
                    history=formatted_history,
                    system_prompt=enhanced_system_prompt,
                    temperature=user_preferences.get('temperature', 0.7),
                    max_tokens=user_preferences.get('max_tokens', 2048)
                ):
                    full_response += chunk

                    # Send chunk to client
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

                # Save the complete AI response to database
                ai_message_data = {
                    "id": str(uuid.uuid4()),
                    "chat_id": chat_id,
                    "role": "assistant",
                    "content": full_response,
                    "created_at": datetime.utcnow().isoformat(),
                    "metadata": {
                        "model": user_preferences.get('default_model', 'gemini-1.5-flash'),
                        "enhanced_context": True,
                        "context_summary_updated": True
                    }
                }
                ai_response = user_supabase.table("messages").insert(
                    ai_message_data).execute()

                # Update context summary with new conversation
                try:
                    await context_manager.update_context_summary(
                        chat_id=chat_id,
                        recent_messages=message_history[:-1],  # Exclude current user message
                        new_ai_response=full_response,
                        current_summary=chat_data.get('context_summary', '')
                    )
                except Exception as e:
                    logger.warning(f"Failed to update context summary for chat {chat_id}: {str(e)}")
                    # Don't fail the stream if summary update fails

                # Update chat timestamp
                user_supabase.table("chats").update({
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", chat_id).execute()

                logger.info(
                    f"AI streaming message saved: {
                        ai_message_data['id']}")
                # Send completion signal with the saved message
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


@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific message"""
    try:
        # Get message and verify user has access to the chat
        response = supabase.table("messages").select(
            "*, chats!inner(user_id)").eq("id", message_id).execute()

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


@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a message"""
    try:
        # Get message and verify user has access to the chat
        response = supabase.table("messages").select(
            "*, chats!inner(user_id)").eq("id", message_id).execute()

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


# Helper functions

def _determine_task_type_from_command(command: str) -> TaskType:
    """Determine task type from command"""
    command = command.lower()

    if '/organize' in command:
        return TaskType.ORGANIZE
    elif '/search' in command:
        return TaskType.SEARCH
    elif '/cleanup' in command:
        return TaskType.CLEANUP
    elif '/folder' in command:
        return TaskType.FOLDER_OPERATION
    elif 'backup' in command:
        return TaskType.BACKUP
    else:
        return TaskType.ANALYSIS
