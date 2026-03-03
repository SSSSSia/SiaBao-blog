# -*- coding: utf-8 -*-
"""Authentication service."""
from secrets import compare_digest

from app.core.config import get_settings
from app.core.security import verify_password

settings = get_settings()


async def authenticate_user(username: str, password: str) -> bool:
    """Authenticate user credentials."""
    if username != settings.admin_username:
        return False

    stored_password = settings.admin_password

    # Support both bcrypt hash and plain text env value.
    # In production, bcrypt hash should be used.
    if stored_password.startswith(("$2a$", "$2b$", "$2y$")):
        return verify_password(password, stored_password)

    return compare_digest(password, stored_password)
