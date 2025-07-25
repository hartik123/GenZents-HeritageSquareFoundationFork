from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, Dict, Any, List

class TestResponse(BaseModel):
    content: str

class TestRequest(BaseModel):
    content: str

class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000, description="Message content")
    role: str = Field(default="user", pattern=r"^(user|assistant|system|function)$")
    metadata: Optional[Dict[str, Any]] = None
    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        if not v or not v.strip():
            raise ValueError('Content cannot be empty')
        return v.strip()


class MessageUpdate(BaseModel):
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    chat_id: str
    user_id: Optional[str] = None
    role: str
    content: str
    created_at: str
    updated_at: Optional[str] = None
    deleted: bool = False
    metadata: Optional[Dict[str, Any]] = None


class StreamingResponse(BaseModel):
    type: str
    data: Optional[Any] = None
    content: Optional[str] = None
    message: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
