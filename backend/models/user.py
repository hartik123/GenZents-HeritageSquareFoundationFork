from pydantic import BaseModel, ConfigDict
from typing import Optional


class User(BaseModel):
    """
    Minimal user model for backend authentication
    Full user data with preferences, permissions, etc. is managed in frontend types
    This model only contains fields needed for backend API authentication and processing
    """
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: Optional[str] = None


class AuthResponse(BaseModel):
    """Authentication response model"""
    user: User
    access_token: str
    token_type: str = "bearer"
