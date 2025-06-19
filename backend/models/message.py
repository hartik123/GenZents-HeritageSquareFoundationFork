from pydantic import BaseModel
from typing import Optional, Dict, Any

class MessageCreate(BaseModel):
    content: str
    role: str = "user"
    metadata: Optional[Dict[str, Any]] = None

class MessageUpdate(BaseModel):
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class MessageResponse(BaseModel):
    id: str
    chat_id: str
    role: str
    content: str
    created_at: str
    updated_at: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True
