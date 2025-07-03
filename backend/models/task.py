from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from enum import Enum


class TaskStatus(str, Enum):
    """Aligned with frontend TaskStatus type"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskType(str, Enum):
    """Task types for computation-heavy operations"""
    ORGANIZE = "organize"
    SEARCH = "search"
    CLEANUP = "cleanup"
    FOLDER_OPERATION = "folder_operation"
    BACKUP = "backup"
    ANALYSIS = "analysis"


class TaskCreate(BaseModel):
    """Create task request - computation-heavy operations only"""
    type: TaskType
    command: str = Field(..., min_length=1, max_length=500)
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    chat_id: Optional[str] = None
    priority: int = Field(default=5, ge=1, le=10)
    estimated_duration: Optional[int] = None  # seconds
    max_retries: int = Field(default=3, ge=0, le=10)


class TaskUpdate(BaseModel):
    """Update task metadata - used by backend during processing"""
    status: Optional[TaskStatus] = None
    progress: Optional[int] = Field(None, ge=0, le=100)
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    logs: Optional[List[str]] = None


class TaskResponse(BaseModel):
    """Task response - aligned with frontend Task type"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: Optional[str] = None  # Match frontend optional field
    chat_id: Optional[str] = None
    command_id: str  # Maps to frontend Task.command_id field
    parameters: Dict[str, Any] = Field(default_factory=dict)
    status: TaskStatus
    progress: int = 0
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    logs: List[str] = Field(default_factory=list)
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    estimated_duration: Optional[int] = None
    priority: int = 5
    retry_count: int = 0
    updated_at: str

    @classmethod
    def from_task_data(cls, task_data: Dict[str, Any]):
        """Convert backend task data to frontend-compatible format"""
        # Map 'type' field to 'command_id' for frontend compatibility
        if 'type' in task_data:
            task_data['command_id'] = task_data.pop('type')
        return cls(**task_data)


class TaskListResponse(BaseModel):
    """Paginated task list response"""
    tasks: List[TaskResponse]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_prev: bool


class TaskStopRequest(BaseModel):
    """Cancel task request"""
    reason: Optional[str] = "User requested cancellation"
