"""Pydantic schemas for Auth Service API."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# Request schemas
class UserCreate(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


# Response schemas
class UserResponse(BaseModel):
    """Schema for user info response."""
    id: int
    email: str
    full_name: Optional[str] = None
    is_admin: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Schema for token response."""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int


class TokenRefreshRequest(BaseModel):
    """Schema for token refresh request."""
    refresh_token: str


class TokenValidateRequest(BaseModel):
    """Schema for internal token validation."""
    token: str


class TokenValidateResponse(BaseModel):
    """Schema for internal token validation response."""
    valid: bool
    user_id: Optional[int] = None
    email: Optional[str] = None
    is_admin: Optional[bool] = None
    error: Optional[str] = None
