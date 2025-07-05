from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from typing import List, Optional
from storage.database import supabase, get_current_user, get_user_supabase_client
from models.task import TaskCreate, TaskResponse, TaskUpdate, TaskListResponse, TaskStopRequest, TaskType
from models.user import User
from services.task_processor import task_processor
from utils.command_processor import command_processor
from utils.logger import logger
import uuid
from datetime import datetime
import re

router = APIRouter(prefix="/api/tasks", tags=["tasks"])
security = HTTPBearer()


def get_authenticated_supabase(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get Supabase client authenticated with user's token"""
    try:
        token = credentials.credentials
        return get_user_supabase_client(token)
    except Exception as e:
        logger.error(f"Failed to authenticate user: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )


@router.post("/", response_model=TaskResponse)
async def create_task(
    task: TaskCreate,
    current_user: User = Depends(get_current_user),
    user_supabase=Depends(get_authenticated_supabase)
):
    """Create a new long-running task"""
    try:
        logger.info(
            f"Creating task for user {
                current_user.id}: {
                task.command}")

        # Parse command to determine task type and parameters
        task_type, parameters = _parse_command_for_task(
            task.command, task.parameters)

        task_data = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "chat_id": task.chat_id,
            "type": task_type.value,
            "command": task.command,
            "parameters": parameters,
            "status": "pending",
            "progress": 0,
            "priority": task.priority,
            "estimated_duration": task.estimated_duration,
            "max_retries": task.max_retries,
            "retry_count": 0,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        logger.info(f"Inserting task data: {task_data}")
        response = user_supabase.table("tasks").insert(task_data).execute()

        if not response.data:
            logger.error("No data returned from task creation")
            raise HTTPException(
                status_code=500,
                detail="Task creation failed - no data returned"
            )

        logger.info(f"Task created successfully: {response.data[0]['id']}")
        return TaskResponse.from_task_data(response.data[0])

    except Exception as e:
        error_detail = str(e)
        logger.error(f"Error creating task: {error_detail}")

        if "row-level security policy" in error_detail.lower():
            raise HTTPException(
                status_code=403,
                detail="Permission denied"
            )
        elif "authentication" in error_detail.lower():
            raise HTTPException(
                status_code=401,
                detail="Authentication required"
            )
        else:
            raise HTTPException(status_code=500, detail="Task creation failed")


@router.get("/", response_model=TaskListResponse)
async def get_tasks(
    current_user: User = Depends(get_current_user),
    user_supabase=Depends(get_authenticated_supabase),
    status_filter: Optional[str] = Query(
        None, description="Filter by task status"),
    task_type: Optional[str] = Query(None, description="Filter by task type"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100)
):
    """Get tasks for the current user"""
    try:
        query = user_supabase.table("tasks").select("*", count="exact")

        # Apply filters
        if status_filter:
            query = query.eq("status", status_filter)
        if task_type:
            query = query.eq("type", task_type)

        # Apply pagination
        offset = (page - 1) * per_page
        query = query.order(
            "created_at",
            desc=True).range(
            offset,
            offset + per_page - 1)

        response = query.execute()

        if response.data is None:
            tasks = []
            total = 0
        else:
            # Transform tasks using TaskResponse.from_task_data for frontend
            # compatibility
            tasks = [TaskResponse.from_task_data(
                task) for task in response.data]
            total = response.count if response.count is not None else len(
                tasks)

        return TaskListResponse(
            tasks=tasks,
            total=total,
            page=page,
            per_page=per_page,
            has_next=total > page * per_page,
            has_prev=page > 1
        )

    except Exception as e:
        logger.error(f"Error fetching tasks: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch tasks")


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    user_supabase=Depends(get_authenticated_supabase)
):
    """Get a specific task"""
    try:
        response = user_supabase.table("tasks").select(
            "*").eq("id", task_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Task not found")

        return TaskResponse.from_task_data(response.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching task {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch task")


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user),
    user_supabase=Depends(get_authenticated_supabase)
):
    """Update a task (admin only for most fields)"""
    try:
        # Check if task exists and user owns it
        existing_response = user_supabase.table(
            "tasks").select("*").eq("id", task_id).execute()

        if not existing_response.data:
            raise HTTPException(status_code=404, detail="Task not found")

        # Prepare update data
        update_data = {
            "updated_at": datetime.utcnow().isoformat()
        }

        # Add provided fields to update
        if task_update.status is not None:
            update_data["status"] = task_update.status.value
        if task_update.progress is not None:
            update_data["progress"] = task_update.progress
        if task_update.result is not None:
            update_data["result"] = task_update.result
        if task_update.error_message is not None:
            update_data["error_message"] = task_update.error_message
        if task_update.logs is not None:
            update_data["logs"] = task_update.logs

        response = user_supabase.table("tasks").update(
            update_data).eq("id", task_id).execute()

        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to update task")

        return TaskResponse.from_task_data(response.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating task {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update task")


@router.post("/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    stop_request: TaskStopRequest,
    current_user: User = Depends(get_current_user)
):
    """Cancel a running task"""
    try:
        success = await task_processor.cancel_task(task_id, current_user.id)

        if not success:
            raise HTTPException(
                status_code=400,
                detail="Task cannot be cancelled (not found, not owned by user, or already completed)"
            )

        return {"message": "Task cancelled successfully",
                "reason": stop_request.reason}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling task {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel task")


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    user_supabase=Depends(get_authenticated_supabase)
):
    """Delete a task"""
    try:
        response = user_supabase.table(
            "tasks").delete().eq("id", task_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Task not found")

        return {"message": "Task deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting task {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete task")


@router.post("/process-command", response_model=TaskResponse)
async def process_command_as_task(
    command: str,
    chat_id: Optional[str] = None,
    priority: int = 5,
    current_user: User = Depends(get_current_user),
    user_supabase=Depends(get_authenticated_supabase)
):
    """Process a command as a long-running task"""
    try:
        # Check if the command should be processed as a task
        if not _is_long_running_command(command):
            raise HTTPException(
                status_code=400,
                detail="Command does not require background processing"
            )

        # Create task from command
        task_create = TaskCreate(
            type=_determine_task_type(command),
            command=command,
            chat_id=chat_id,
            priority=priority
        )

        return await create_task(task_create, current_user, user_supabase)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing command as task: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process command")


# Helper functions

def _parse_command_for_task(
        command: str, provided_parameters: dict) -> tuple[TaskType, dict]:
    """Parse command to determine task type and extract parameters"""
    command = command.strip().lower()
    parameters = provided_parameters.copy()

    if command.startswith('/organize'):
        task_type = TaskType.ORGANIZE
        # Extract path if provided
        parts = command.split()
        if len(parts) > 1:
            parameters["path"] = " ".join(parts[1:])

    elif command.startswith('/search'):

        task_type = TaskType.SEARCH
        # Extract search query
        parts = command.split()
        if len(parts) > 1:
            parameters["query"] = " ".join(parts[1:])

    elif command.startswith('/cleanup'):
        task_type = TaskType.CLEANUP
        # Extract cleanup options
        parts = command.split()
        if len(parts) > 1:
            parameters["options"] = parts[1:]

    elif command.startswith('/folder'):
        task_type = TaskType.FOLDER_OPERATION
        # Extract folder name and action
        if ':' in command:
            folder_part = command.split(':')[1].split()[0]
            parameters["folder_name"] = folder_part
        parts = command.split()
        if len(parts) > 1:
            parameters["action"] = parts[-1] if parts[-1] in ["create",
                                                              "navigate"] else "create"

    elif 'backup' in command:
        task_type = TaskType.BACKUP

    elif 'analyze' in command or 'analysis' in command:
        task_type = TaskType.ANALYSIS

    else:
        # Default to analysis for unknown commands
        task_type = TaskType.ANALYSIS

    return task_type, parameters


def _is_long_running_command(command: str) -> bool:
    """Check if a command should be processed as a long-running task"""
    long_running_keywords = [
        '/organize', '/search', '/cleanup', '/backup',
        'analyze', 'scan', 'index', 'process large',
        'batch', 'bulk', 'mass operation'
    ]

    command_lower = command.lower()
    return any(keyword in command_lower for keyword in long_running_keywords)


def _determine_task_type(command: str) -> TaskType:
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
