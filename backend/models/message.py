from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, Dict, Any, List


class MessageCreate(BaseModel):
    """Create message request for AI processing"""
    content: str = Field(...,
                         min_length=1,
                         max_length=10000,
                         description="Message content")
    role: str = Field(
        default="user",
        pattern=r"^(user|assistant|system|function)$")
    metadata: Optional[Dict[str, Any]] = None

    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        if not v or not v.strip():
            raise ValueError('Content cannot be empty')
        return v.strip()


class MessageUpdate(BaseModel):
    """Update message - minimal fields for backend use"""
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class MessageResponse(BaseModel):
    """Message response from AI processing - aligned with frontend Message type"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    chat_id: str
    user_id: Optional[str] = None  # Match frontend optional field
    role: str  # "user" | "assistant" | "system" | "function"
    content: str
    created_at: str  # ISO string format
    updated_at: Optional[str] = None
    deleted: bool = False  # Match frontend Message type
    metadata: Optional[Dict[str, Any]] = None
    # Note: Frontend handles additional fields like status, reactions via
    # direct Supabase


class StreamingResponse(BaseModel):
    """Streaming response for real-time AI responses"""
    type: str  # "chunk" | "complete" | "error" | "message" | "done" | "command"
    data: Optional[Any] = None
    content: Optional[str] = None
    message: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
