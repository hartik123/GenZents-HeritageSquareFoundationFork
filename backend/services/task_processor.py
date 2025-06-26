import asyncio
import uuid
import time
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from storage.database import supabase
from models.task import TaskStatus, TaskType, TaskResponse, TaskUpdate
from services.command_processor import command_processor
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
                    f"Task {task_id} will be retried ({
                        retry_count + 1}/{max_retries})")
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
        """Execute task based on its type"""
        command = task_data["command"]
        parameters = task_data.get("parameters", {})
        task_id = task_data["id"]

        # Add progress logging
        await self._add_task_log(task_id, f"Starting {task_type.value} task: {command}")

        if task_type == TaskType.ORGANIZE:
            return await self._handle_organize_task(task_id, command, parameters)
        elif task_type == TaskType.SEARCH:
            return await self._handle_search_task(task_id, command, parameters)
        elif task_type == TaskType.CLEANUP:
            return await self._handle_cleanup_task(task_id, command, parameters)
        elif task_type == TaskType.FOLDER_OPERATION:
            return await self._handle_folder_task(task_id, command, parameters)
        elif task_type == TaskType.BACKUP:
            return await self._handle_backup_task(task_id, command, parameters)
        elif task_type == TaskType.ANALYSIS:
            return await self._handle_analysis_task(task_id, command, parameters)
        else:
            raise ValueError(f"Unknown task type: {task_type}")

    async def _handle_organize_task(
            self, task_id: str, command: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle file organization task"""
        await self._update_task_progress(task_id, 10)
        await self._add_task_log(task_id, "Scanning directory structure...")
        await asyncio.sleep(2)  # Simulate work

        await self._update_task_progress(task_id, 30)
        await self._add_task_log(task_id, "Analyzing file types and sizes...")
        await asyncio.sleep(3)

        await self._update_task_progress(task_id, 60)
        await self._add_task_log(task_id, "Creating organized folder structure...")
        await asyncio.sleep(2)

        await self._update_task_progress(task_id, 80)
        await self._add_task_log(task_id, "Moving files to appropriate folders...")
        await asyncio.sleep(3)

        await self._update_task_progress(task_id, 95)
        await self._add_task_log(task_id, "Cleaning up empty directories...")
        await asyncio.sleep(1)

        return {
            "files_organized": 342,
            "folders_created": 12,
            "empty_folders_removed": 5,
            "space_saved": "2.3 GB",
            "duration_seconds": 11
        }

    async def _handle_search_task(
            self, task_id: str, command: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle search task"""
        query = parameters.get("query", "")

        await self._update_task_progress(task_id, 20)
        await self._add_task_log(task_id, f"Indexing files for search query: '{query}'...")
        await asyncio.sleep(2)

        await self._update_task_progress(task_id, 50)
        await self._add_task_log(task_id, "Searching through file contents...")
        await asyncio.sleep(3)

        await self._update_task_progress(task_id, 80)
        await self._add_task_log(task_id, "Ranking and filtering results...")
        await asyncio.sleep(1)

        return {
            "query": query,
            "results_found": 28,
            "files_searched": 1543,
            "search_time_seconds": 6,
            "top_matches": [
                {"file": "document1.pdf", "relevance": 0.95},
                {"file": "notes.txt", "relevance": 0.87},
                {"file": "presentation.pptx", "relevance": 0.76}
            ]
        }

    async def _handle_cleanup_task(
            self, task_id: str, command: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle cleanup task"""
        await self._update_task_progress(task_id, 15)
        await self._add_task_log(task_id, "Scanning for temporary files...")
        await asyncio.sleep(2)

        await self._update_task_progress(task_id, 35)
        await self._add_task_log(task_id, "Finding duplicate files...")
        await asyncio.sleep(3)

        await self._update_task_progress(task_id, 55)
        await self._add_task_log(task_id, "Clearing cache directories...")
        await asyncio.sleep(2)

        await self._update_task_progress(task_id, 75)
        await self._add_task_log(task_id, "Optimizing file system...")
        await asyncio.sleep(2)

        await self._update_task_progress(task_id, 90)
        await self._add_task_log(task_id, "Removing empty folders...")
        await asyncio.sleep(1)

        return {
            "temp_files_removed": 156,
            "duplicates_found": 23,
            "cache_cleared": "1.8 GB",
            "empty_folders_removed": 8,
            "total_space_freed": "2.1 GB"
        }

    async def _handle_folder_task(
            self, task_id: str, command: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle folder operation task"""
        folder_name = parameters.get("folder_name", "")
        action = parameters.get("action", "create")

        await self._update_task_progress(task_id, 25)
        await self._add_task_log(task_id, f"Processing folder '{folder_name}' with action '{action}'...")
        await asyncio.sleep(1)

        await self._update_task_progress(task_id, 75)
        await self._add_task_log(task_id, "Setting up folder structure...")
        await asyncio.sleep(2)

        return {
            "folder_name": folder_name,
            "action": action,
            "success": True,
            "path": f"/organized/{folder_name}"
        }

    async def _handle_backup_task(
            self, task_id: str, command: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle backup task"""
        await self._update_task_progress(task_id, 10)
        await self._add_task_log(task_id, "Preparing backup...")
        await asyncio.sleep(2)

        await self._update_task_progress(task_id, 40)
        await self._add_task_log(task_id, "Compressing files...")
        await asyncio.sleep(4)

        await self._update_task_progress(task_id, 80)
        await self._add_task_log(task_id, "Uploading to cloud storage...")
        await asyncio.sleep(3)

        return {
            "files_backed_up": 1247,
            "backup_size": "4.2 GB",
            "compression_ratio": 0.73,
            "backup_location": "cloud://backups/user_backup_20250626.zip"
        }

    async def _handle_analysis_task(
            self, task_id: str, command: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Handle analysis task"""
        await self._update_task_progress(task_id, 20)
        await self._add_task_log(task_id, "Collecting file statistics...")
        await asyncio.sleep(2)

        await self._update_task_progress(task_id, 50)
        await self._add_task_log(task_id, "Analyzing usage patterns...")
        await asyncio.sleep(3)

        await self._update_task_progress(task_id, 80)
        await self._add_task_log(task_id, "Generating insights...")
        await asyncio.sleep(2)

        return {
            "total_files": 2847,
            "total_size": "12.4 GB",
            "file_types": {
                "documents": 1203,
                "images": 856,
                "videos": 124,
                "code": 664
            },
            "recommendations": [
                "Consider archiving files older than 2 years",
                "Large video files can be compressed",
                "Duplicate documents found in multiple folders"
            ]
        }

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
