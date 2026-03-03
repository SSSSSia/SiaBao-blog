# -*- coding: utf-8 -*-
"""Authentication schemas."""
from pydantic import BaseModel


class UserInfo(BaseModel):
    """User information schema."""

    username: str
    role: str = "admin"


class LoginRequest(BaseModel):
    """Login request schema."""

    username: str
    password: str


class TokenResponse(BaseModel):
    """Token response schema."""

    access_token: str
    token_type: str = "bearer"
    user: UserInfo
