from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from typing import List, Optional
from storage.database import supabase, get_current_user, get_user_supabase_client
from models.message import MessageCreate, MessageResponse, MessageUpdate
from models.task import TaskType
from models.user import User
from utils.logger import logger
from services.context_manager import get_context_manager
from services.user_security import get_security_service
import uuid
import json
from datetime import datetime
from services.generative_ai import generate_text, generate_text_stream
from utils.command_processor import command_processor

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
    """Create a new message in a chat and get a response from the AI"""
    try:
        logger.info(
            f"""Creating message for chat {chat_id} by user {
                current_user.id}""")

        # 1. Initialize services
        context_manager = get_context_manager(user_supabase)
        security_service = get_security_service(user_supabase)

        # 2. Verify user has access to this chat and get chat details
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

        # 3. Fetch user stats/constraints and validate request should be
        # processed
        security_service = get_security_service(user_supabase)
        user_constraints = await security_service.get_user_constraints(current_user.id)

        # Check if user's request should be processed based on constraints
        message_check = await security_service.check_user_can_send_message(
            current_user.id, message.content
        )
        if not message_check.allowed:
            raise HTTPException(status_code=403, detail=message_check.reason)

        # 4. Prepare comprehensive LLM context with security checks
        try:
            enhanced_system_prompt, message_history, user_preferences, security_context = await context_manager.prepare_llm_context(
                user_id=current_user.id,
                chat_id=chat_id,
                user_message=message.content
            )
        except ValueError as e:
            # Security validation failed
            raise HTTPException(status_code=403, detail=str(e))

        # 5. Check for commands in the message and filter allowed commands
        command_result, remaining_message = command_processor.extract_command_and_message(
            message.content)

        # 5.1. If command found, check permissions and filter allowed commands
        allowed_commands = []
        if command_result:
            # Extract all commands from the message
            all_commands = command_processor.extract_all_commands(
                message.content)

            # Filter commands based on user permissions
            for cmd in all_commands:
                command_permission_check = await security_service.check_command_permissions(
                    current_user.id, cmd
                )
                if command_permission_check.allowed:
                    allowed_commands.append(cmd)
                else:
                    # Log denied command for auditing
                    logger.warning(
                        f"""Command denied for user {
                            current_user.id}: {cmd} - {
                            command_permission_check.reason}""")

            # If no commands are allowed, create error message
            if not allowed_commands and all_commands:
                permission_error_content = f"❌ **Commands Not Permitted**\n\n"
                permission_error_content += "The following commands were denied:\n"
                for cmd in all_commands:
                    check = await security_service.check_command_permissions(current_user.id, cmd)
                    permission_error_content += f"• `{cmd}`: {check.reason}\n"

                error_message_data = {
                    "id": str(uuid.uuid4()),
                    "chat_id": chat_id,
                    "role": "assistant",
                    "content": permission_error_content,
                    "created_at": datetime.utcnow().isoformat(),
                    "metadata": {"is_error": True, "error_type": "permission_denied"}
                }

                user_supabase.table("messages").insert(
                    error_message_data).execute()

                raise HTTPException(
                    status_code=403,
                    detail="No permitted commands found in message"
                )

        # 5.2. Check if any allowed commands are long-running and should become
        # tasks
        long_running_commands = []
        if allowed_commands:
            for cmd in allowed_commands:
                if command_processor.is_long_running_command(cmd):
                    long_running_commands.append(cmd)

            # Create tasks for long-running commands
            if long_running_commands:
                task_ids = []
                for cmd in long_running_commands:
                    task_type = _determine_task_type_from_command(cmd)

                    task_data = {
                        "id": str(uuid.uuid4()),
                        "user_id": current_user.id,
                        "chat_id": chat_id,
                        "type": task_type.value,
                        "command": cmd,
                        "parameters": {},
                        "status": "pending",
                        "progress": 0,
                        "priority": 5,
                        "max_retries": 3,
                        "retry_count": 0,
                        "created_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    }

                    task_response = user_supabase.table(
                        "tasks").insert(task_data).execute()
                    task_ids.append(task_response.data[0]["id"])

                # Create notification message about created tasks
                task_notification_content = f"🔄 **Background Tasks Created**\n\n"
                task_notification_content += f"The following long-running commands have been queued:\n"
                for i, cmd in enumerate(long_running_commands):
                    task_notification_content += f"""• `{cmd}` (Task ID: `{task_ids[i]}`)\n"""
                task_notification_content += "\nTasks are running in the background. Check the Tasks page for progress."

                task_message_data = {
                    "id": str(uuid.uuid4()),
                    "chat_id": chat_id,
                    "role": "assistant",
                    "content": task_notification_content,
                    "created_at": datetime.utcnow().isoformat(),
                    "metadata": {
                        "is_task_notification": True,
                        "task_ids": task_ids,
                        "commands": long_running_commands
                    }
                }
                user_supabase.table("messages").insert(
                    task_message_data).execute()

                # Remove long-running commands from allowed_commands for
                # immediate processing
                allowed_commands = [
                    cmd for cmd in allowed_commands if cmd not in long_running_commands]

        # 6. Save user's message (original content)
        user_message_data = {
            "id": str(uuid.uuid4()),
            "chat_id": chat_id,
            "role": "user",
            "content": message.content,
            "created_at": datetime.utcnow().isoformat(),
            "metadata": {
                "has_commands": len(allowed_commands) > 0,
                "commands_processed": allowed_commands,
                "long_running_tasks_created": len(long_running_commands) if 'long_running_commands' in locals() else 0
            }
        }
        user_response = user_supabase.table(
            "messages").insert(user_message_data).execute()
        logger.info(f"User message saved: {user_message_data['id']}")

        # 7. Process immediate (non-long-running) allowed commands
        command_results = []
        if allowed_commands:
            for cmd in allowed_commands:
                cmd_result = command_processor.process_command(cmd)
                if cmd_result and cmd_result.success:
                    command_results.append(cmd_result)

            # If we have command results, save them
            if command_results:
                command_content = "**Commands Executed:**\n\n"
                for result in command_results:
                    command_content += f"""• `{
                        result.command}`: {
                        result.message}\n"""
                    if result.suggestions:
                        command_content += f"""  - {
                            ', '.join(result.suggestions)}\n"""

                command_message_data = {
                    "id": str(uuid.uuid4()),
                    "chat_id": chat_id,
                    "role": "assistant",
                    "content": command_content,
                    "created_at": datetime.utcnow().isoformat(),
                    "metadata": {
                        "is_command_result": True,
                        "command_results": [{"command": r.command, "success": r.success, "data": r.data} for r in command_results]
                    }
                }
                user_supabase.table("messages").insert(
                    command_message_data).execute()
                logger.info(
                    f"""Command results saved: {
                        command_message_data['id']}""")

        # 8. Generate AI response for the message (including any remaining content)
        # Use the remaining message or full content if no commands were
        # processed
        message_for_ai = remaining_message if remaining_message and allowed_commands else message.content

        # Convert message_history to the format expected by generate_text
        formatted_history = []
        for msg in message_history[:-
                                   1]:  # Exclude the current message we just added
            formatted_history.append({
                "role": msg.get("role"),
                "content": msg.get("content")
            })

        # Enhance system prompt with security context
        security_enhanced_prompt = enhanced_system_prompt + f"""

SECURITY CONTEXT:
- User permissions: {', '.join(security_context['user_permissions'])}
- Admin status: {security_context['is_admin']}
- User status: {security_context.get('user_status', 'active')}

IMPORTANT SAFETY GUIDELINES:
1. Only suggest actions the user has permission for
2. If user requests unauthorized actions, explain why it's not allowed
3. Always respect user constraints and quotas
4. Never bypass security measures or suggest workarounds
5. Be helpful within the allowed scope of permissions
"""

        # Check if user has file organization permissions to use drive tools
        has_drive_permissions = "file_organization" in security_context[
            'user_permissions'] or security_context['is_admin']

        if has_drive_permissions:
            # Use AI with drive tools
            from services.generative_ai import generate_text_with_tools
            ai_response_text = await generate_text_with_tools(
                prompt=message_for_ai,
                history=formatted_history,
                system_prompt=security_enhanced_prompt,
                user_id=current_user.id,
                user_supabase_client=user_supabase
            )
        else:
            # Use regular AI without tools
            ai_response_text = generate_text(
                prompt=message_for_ai,
                history=formatted_history,
                system_prompt=security_enhanced_prompt
            )

        # Calculate token usage (approximate)
        estimated_tokens = (len(message.content) + len(ai_response_text)) // 4

        # Update user usage statistics
        await security_service.update_user_usage(
            user_id=current_user.id,
            tokens_used=estimated_tokens,
            messages_count=1
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
                "context_summary_updated": True,
                "tokens_used": estimated_tokens,
                "security_context_applied": True
            }
        }
        response = user_supabase.table(
            "messages").insert(ai_message_data).execute()

        # 7. Update context summary with new conversation
        try:
            await context_manager.update_context_summary(
                chat_id=chat_id,
                # Exclude current user message
                recent_messages=message_history[:-1],
                new_ai_response=ai_response_text,
                current_summary=chat_data.get('context_summary', '')
            )
        except Exception as e:
            logger.warning(
                f"""Failed to update context summary for chat {chat_id}: {
                    str(e)}""")
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
            f"""Creating streaming message for chat {chat_id} by user {
                current_user.id}""")

        # Initialize context manager
        context_manager = get_context_manager(user_supabase)

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

        # Prepare comprehensive LLM context
        enhanced_system_prompt, message_history, user_preferences = await context_manager.prepare_llm_context(
            user_id=current_user.id,
            chat_id=chat_id,
            user_message=message.content
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
            f"""User message saved for streaming: {
                user_message_data['id']}""")

        async def generate_response():
            try:
                # Handle commands first if present
                if command_result and command_result.success:
                    command_content = f"**Command Executed:** {
                        command_result.message}"
                    if command_result.suggestions:
                        command_content += f"""\n\n{
                            chr(10).join(
                                f'• {suggestion}' for suggestion in command_result.suggestions)}"""

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

                # Convert message_history to the format expected by
                # generate_text_stream
                formatted_history = []
                for msg in message_history[:-
                                           1]:  # Exclude the current message we just added
                    formatted_history.append({
                        "role": msg.get("role"),
                        "content": msg.get("content")
                    })

                # Stream the AI response
                full_response = ""
                async for chunk in generate_text_stream(
                    prompt=message_for_ai,
                    history=formatted_history,
                    system_prompt=enhanced_system_prompt
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
                        # Exclude current user message
                        recent_messages=message_history[:-1],
                        new_ai_response=full_response,
                        current_summary=chat_data.get('context_summary', '')
                    )
                except Exception as e:
                    logger.warning(
                        f"""Failed to update context summary for chat {chat_id}: {
                            str(e)}""")
                    # Don't fail the stream if summary update fails

                # Update chat timestamp
                user_supabase.table("chats").update({
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", chat_id).execute()

                logger.info(
                    f"""AI streaming message saved: {
                        ai_message_data['id']}""")
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
