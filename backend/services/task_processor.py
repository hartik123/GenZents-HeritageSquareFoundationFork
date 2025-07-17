import asyncio
import uuid
import time
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from storage.database import supabase
from models.task import TaskStatus, TaskType, TaskResponse, TaskUpdate
from utils.command_processor import command_processor
from utils.logger import logger
import json


class TaskProcessor:
    """Background task processor for handling long-running operations"""

    def __init__(self):
        self.running = False
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.poll_interval = 5  # seconds
        self.max_concurrent_tasks = 5

    async def start(self):
        """Start the background task processor"""
        if self.running:
            logger.warning("Task processor already running")
            return

        self.running = True
        logger.info("Starting task processor")

        # Start the main polling loop
        asyncio.create_task(self._poll_loop())

    async def stop(self):
        """Stop the background task processor"""
        self.running = False

        # Cancel all active tasks
        for task_id, task in self.active_tasks.items():
            task.cancel()
            logger.info(f"Cancelled task {task_id}")

        self.active_tasks.clear()
        logger.info("Task processor stopped")

    async def _poll_loop(self):
        """Main polling loop to check for new tasks"""
        while self.running:
            try:
                await self._process_pending_tasks()
                await self._cleanup_completed_tasks()
                await asyncio.sleep(self.poll_interval)
            except Exception as e:
                logger.error(f"Error in task polling loop: {e}")
                await asyncio.sleep(self.poll_interval)

    async def _process_pending_tasks(self):
        """Process pending tasks from the database"""
        if len(self.active_tasks) >= self.max_concurrent_tasks:
            return

        try:
            # Get pending tasks ordered by priority and creation time
            response = supabase.table("tasks").select("*").eq(
                "status", TaskStatus.PENDING.value).order(
                "priority", desc=True).order(
                "created_at", desc=False).limit(
                self.max_concurrent_tasks - len(
                    self.active_tasks)).execute()

            if not response.data:
                return

            for task_data in response.data:
                if len(self.active_tasks) >= self.max_concurrent_tasks:
                    break

                task_id = task_data["id"]
                if task_id not in self.active_tasks:
                    # Start processing the task
                    task = asyncio.create_task(self._execute_task(task_data))
                    self.active_tasks[task_id] = task
                    logger.info(f"Started processing task {task_id}")

        except Exception as e:
            logger.error(f"Error processing pending tasks: {e}")

    async def _execute_task(self, task_data: Dict[str, Any]):
        """Execute a single task"""
        task_id = task_data["id"]

        try:
            # Update task status to running
            await self._update_task_status(task_id, TaskStatus.RUNNING, {"started_at": datetime.utcnow().isoformat()})

            # Process the task based on its type
            task_type = TaskType(task_data["type"])
            result = await self._run_task_by_type(task_type, task_data)

            # Update task as completed
            await self._update_task_status(
                task_id,
                TaskStatus.COMPLETED,
                {
                    "progress": 100,
                    "result": result,
                    "completed_at": datetime.utcnow().isoformat()
                }
            )

            logger.info(f"Task {task_id} completed successfully")

        except asyncio.CancelledError:
            # Task was cancelled
            await self._update_task_status(
                task_id,
                TaskStatus.CANCELLED,
                {
                    "error_message": "Task was cancelled",
                    "completed_at": datetime.utcnow().isoformat()
                }
            )
            logger.info(f"Task {task_id} was cancelled")

        except Exception as e:
            # Task failed
            error_message = str(e)
            retry_count = task_data.get("retry_count", 0)
            max_retries = task_data.get("max_retries", 3)

            if retry_count < max_retries:
                # Retry the task
                await self._update_task_status(
                    task_id,
                    TaskStatus.PENDING,
                    {
                        "retry_count": retry_count + 1,
                        "error_message": f"Retry {retry_count + 1}/{max_retries}: {error_message}"
                    }
                )
                logger.info(
                    f"""Task {task_id} will be retried ({retry_count + 1}/{max_retries})""")
            else:
                # Mark as failed
                await self._update_task_status(
                    task_id,
                    TaskStatus.FAILED,
                    {
                        "error_message": error_message,
                        "completed_at": datetime.utcnow().isoformat()
                    }
                )
                logger.error(
                    f"Task {task_id} failed after {max_retries} retries: {error_message}")

        finally:
            # Remove from active tasks
            if task_id in self.active_tasks:
                del self.active_tasks[task_id]

    async def _run_task_by_type(
            self, task_type: TaskType, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute task based on its type with proper permission checking"""
        try:
            from services.user_security import get_security_service
            from storage.database import get_user_supabase_client

            # Get user's authenticated supabase client
            user_id = task_data["user_id"]
            user_supabase = get_user_supabase_client(
                None)  # This will need to be enhanced
            security_service = get_security_service(user_supabase)

            # Check if user still has permission to execute this task
            constraints = await security_service.get_user_constraints(user_id)
            command = task_data.get("command", "")

            # Re-check command permissions
            if command:
                permission_check = await security_service.check_command_permissions(user_id, command)
                if not permission_check.allowed:
                    return {
                        "error": f"Permission denied: {permission_check.reason}",
                        "status": "permission_denied"
                    }

            # Execute based on task type
            if task_type == TaskType.FILE_ORGANIZATION:
                return await self._execute_file_organization_task(task_data, user_supabase)
            elif task_type == TaskType.SEARCH_OPERATION:
                return await self._execute_search_task(task_data, user_supabase)
            elif task_type == TaskType.CLEANUP_OPERATION:
                return await self._execute_cleanup_task(task_data, user_supabase)
            elif task_type == TaskType.COMMAND_EXECUTION:
                return await self._execute_command_task(task_data, user_supabase)
            else:
                return {"error": f"Unknown task type: {task_type}",
                        "status": "error"}

        except Exception as e:
            logger.error(f"Error executing task {task_data['id']}: {e}")
            return {"error": str(e), "status": "error"}

    async def _execute_file_organization_task(
            self, task_data: Dict[str, Any], user_supabase) -> Dict[str, Any]:
        """Execute file organization task with change tracking"""
        try:
            from services.drive_agent import create_drive_agent

            # Create drive agent with user context
            drive_agent = create_drive_agent(
                user_id=task_data["user_id"],
                user_supabase_client=user_supabase
            )

            # Process the organization command
            command = task_data.get("command", "")
            result = await drive_agent.process_message(command)

            # The drive agent will handle change tracking internally
            return {
                "result": result,
                "status": "completed",
                "changes_tracked": True
            }

        except Exception as e:
            logger.error(f"Error in file organization task: {e}")
            return {"error": str(e), "status": "error"}

    async def _execute_search_task(
            self, task_data: Dict[str, Any], user_supabase) -> Dict[str, Any]:
        """Execute search task"""
        try:
            from services.drive_agent import create_drive_agent

            drive_agent = create_drive_agent(
                user_id=task_data["user_id"],
                user_supabase_client=user_supabase
            )

            command = task_data.get("command", "")
            result = await drive_agent.process_message(command)

            return {
                "result": result,
                "status": "completed"
            }

        except Exception as e:
            logger.error(f"Error in search task: {e}")
            return {"error": str(e), "status": "error"}

    async def _execute_cleanup_task(
            self, task_data: Dict[str, Any], user_supabase) -> Dict[str, Any]:
        """Execute cleanup task with change tracking"""
        try:
            from services.drive_agent import create_drive_agent

            drive_agent = create_drive_agent(
                user_id=task_data["user_id"],
                user_supabase_client=user_supabase
            )

            command = task_data.get("command", "")
            result = await drive_agent.process_message(command)

            return {
                "result": result,
                "status": "completed",
                "changes_tracked": True
            }

        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")
            return {"error": str(e), "status": "error"}

    async def _execute_command_task(
            self, task_data: Dict[str, Any], user_supabase) -> Dict[str, Any]:
        """Execute general command task"""
        try:
            command = task_data.get("command", "")
            result = command_processor.process_command(command)

            return {
                "result": result.message if result else "Command executed",
                "status": "completed",
                "command_success": result.success if result else False
            }

        except Exception as e:
            logger.error(f"Error in command task: {e}")
            return {"error": str(e), "status": "error"}

    async def _update_task_status(
            self, task_id: str, status: TaskStatus, updates: Dict[str, Any] = None):
        """Update task status in database"""
        try:
            update_data = {"status": status.value,
                           "updated_at": datetime.utcnow().isoformat()}
            if updates:
                update_data.update(updates)

            supabase.table("tasks").update(
                update_data).eq("id", task_id).execute()
        except Exception as e:
            logger.error(f"Error updating task {task_id} status: {e}")

    async def _update_task_progress(self, task_id: str, progress: int):
        """Update task progress"""
        try:
            supabase.table("tasks").update({
                "progress": progress,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", task_id).execute()
        except Exception as e:
            logger.error(f"Error updating task {task_id} progress: {e}")

    async def _add_task_log(self, task_id: str, message: str):
        """Add a log entry to the task"""
        try:
            # Get current logs
            response = supabase.table("tasks").select(
                "logs").eq("id", task_id).execute()
            current_logs = response.data[0]["logs"] if response.data else []

            # Add new log with timestamp
            timestamp = datetime.utcnow().strftime("%H:%M:%S")
            new_log = f"[{timestamp}] {message}"
            updated_logs = current_logs + [new_log]

            supabase.table("tasks").update({
                "logs": updated_logs,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", task_id).execute()
        except Exception as e:
            logger.error(f"Error adding log to task {task_id}: {e}")

    async def _cleanup_completed_tasks(self):
        """Clean up old completed tasks"""
        try:
            # Remove completed tasks older than 7 days
            cutoff_date = (datetime.utcnow() - timedelta(days=7)).isoformat()

            supabase.table("tasks").delete().in_(
                "status", [
                    TaskStatus.COMPLETED.value, TaskStatus.FAILED.value, TaskStatus.CANCELLED.value]).lt(
                "completed_at", cutoff_date).execute()
        except Exception as e:
            logger.error(f"Error cleaning up old tasks: {e}")

    async def cancel_task(self, task_id: str, user_id: str) -> bool:
        """Cancel a running task"""
        try:
            # Check if user owns the task
            response = supabase.table("tasks").select("id,status").eq(
                "id", task_id).eq("user_id", user_id).execute()

            if not response.data:
                return False

            task_data = response.data[0]
            current_status = task_data["status"]

            if current_status in [TaskStatus.COMPLETED.value,
                                  TaskStatus.FAILED.value, TaskStatus.CANCELLED.value]:
                return False

            # Cancel the asyncio task if it's running
            if task_id in self.active_tasks:
                self.active_tasks[task_id].cancel()
                del self.active_tasks[task_id]

            # Update status in database
            await self._update_task_status(
                task_id,
                TaskStatus.CANCELLED,
                {
                    "error_message": "Cancelled by user",
                    "completed_at": datetime.utcnow().isoformat()
                }
            )

            return True
        except Exception as e:
            logger.error(f"Error cancelling task {task_id}: {e}")
            return False


# Global task processor instance
task_processor = TaskProcessor()
