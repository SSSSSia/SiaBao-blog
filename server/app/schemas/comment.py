"""Comment schemas for request and response models."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CommentBase(BaseModel):
    """Base comment schema."""

    content: str = Field(..., min_length=1, max_length=5000, description="Comment content")
    article_id: str = Field(..., description="Associated article ID")
    parent_id: Optional[str] = Field(None, description="Parent comment ID for replies")


class CommentCreate(CommentBase):
    """Schema for creating a new comment."""

    author_name: str = Field(..., min_length=1, max_length=100, description="Author name")
    author_email: Optional[str] = Field(None, description="Author email")


class CommentUpdate(BaseModel):
    """Schema for updating an existing comment."""

    content: str = Field(..., min_length=1, max_length=5000, description="Updated comment content")


class CommentResponse(CommentBase):
    """Schema for comment response."""

    id: str
    author_name: str
    author_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    likes: int = 0
    replies: list["CommentResponse"] = []

    class Config:
        from_attributes = True
