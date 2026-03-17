"""
Auth models — User documents stored in MongoDB `users` collection.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# ── DB model (what we store in Mongo) ─────────────────────────────────────────

class UserInDB(BaseModel):
    """Full user document as stored in MongoDB."""
    email: EmailStr
    full_name: str
    hashed_password: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ── Request / response schemas ─────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=100)
    password: str  = Field(min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserPublic"


class UserPublic(BaseModel):
    """Safe user fields returned to the client (no password hash)."""
    email: EmailStr
    full_name: str
    is_active: bool
    created_at: datetime


# resolve forward reference
TokenResponse.model_rebuild()
