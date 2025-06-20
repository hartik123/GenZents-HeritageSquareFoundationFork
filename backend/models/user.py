from pydantic import BaseModel
from typing import Optional


class User(BaseModel):
    """Simple user model to avoid Supabase import issues"""
    id: str
    email: Optional[str] = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    """Authentication response model"""
    user: User
    access_token: str
    token_type: str = "bearer"
