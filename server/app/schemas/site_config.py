# -*- coding: utf-8 -*-
"""Site configuration schemas for request and response models."""
from typing import Optional

from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    """User profile information for About page."""

    name: str = Field(default="", description="User name")
    title: str = Field(default="", description="User title/position")
    bio: str = Field(default="", description="User biography")
    avatar: str = Field(default="", description="Avatar image path")
    location: str = Field(default="", description="User location")
    joined_date: str = Field(default="", description="Joined date")
    email: str = Field(default="", description="Contact email")
    github: str = Field(default="", description="GitHub profile URL")
    gitee: str = Field(default="", description="Gitee profile URL")
    skills: list[str] = Field(default_factory=list, description="List of skills")


class SiteConfigBase(BaseModel):
    """Base site configuration schema."""

    featured_article_ids: list[str] = Field(
        default_factory=list,
        description="List of featured article IDs"
    )
    recent_articles_count: int = Field(
        default=6,
        ge=1,
        le=20,
        description="Number of recent articles to display on homepage"
    )
    user_profile: UserProfile = Field(
        default_factory=UserProfile,
        description="User profile information"
    )


class SiteConfigUpdate(BaseModel):
    """Schema for updating site configuration."""

    featured_article_ids: Optional[list[str]] = Field(None, description="Featured article IDs")
    recent_articles_count: Optional[int] = Field(None, ge=1, le=20, description="Recent articles count")
    user_profile: Optional[UserProfile] = Field(None, description="User profile information")


class SiteConfigResponse(SiteConfigBase):
    """Schema for site configuration response."""

    class Config:
        from_attributes = True
