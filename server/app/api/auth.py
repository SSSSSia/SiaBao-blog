# -*- coding: utf-8 -*-
"""Authentication API routes."""
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core import R, unauthorized_response
from app.core.config import get_settings
from app.core.security import create_access_token
from app.schemas.auth import LoginRequest
from app.services.auth_service import authenticate_user

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/login")
async def login(login_data: LoginRequest) -> R:
    """Authenticate user and return access token."""
    is_authenticated = await authenticate_user(login_data.username, login_data.password)
    if not is_authenticated:
        return unauthorized_response(message="用户名或密码错误")

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": login_data.username}, expires_delta=access_token_expires
    )

    user_info = {"username": login_data.username, "role": "admin"}

    return R.ok(
        message="登录成功",
        data={
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_info,
        },
    )


@router.get("/me")
async def me(current_user: Annotated[dict, Depends(get_current_user)]) -> R:
    """Get current authenticated user."""
    return R.ok(
        data={
            "username": current_user.get("sub"),
            "role": "admin",
        }
    )
