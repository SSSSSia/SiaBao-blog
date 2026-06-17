# -*- coding: utf-8 -*-
"""Application configuration."""
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Server
    host: str = "0.0.0.0"
    port: int = 9090
    debug: bool = False

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:4173"

    # JWT
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # Admin
    admin_username: str
    admin_password: str

    # AI/LLM Settings
    siliconflow_api_key: str = ""
    siliconflow_base_url: str = "https://api.siliconflow.cn/v1"
    siliconflow_model: str = "Qwen/Qwen2.5-7B-Instruct"

    # Explore / Knowledge Constellation
    explore_github_enabled: bool = True          # GitHub Trending Agent 开关
    github_token: str = ""                       # 可选；启用 5000/hr 配额（建议细粒度只读 PAT）
    explore_cache_ttl: int = 21600               # GitHub 缓存 TTL 秒（6h）
    explore_github_fallback_scrape: bool = False  # Search API 失败时是否启用 HTML 抓取兜底
    explore_max_nodes: int = 120                 # 知识星图节点硬上限

    model_config = {
        "env_file": ".env",
        "case_sensitive": False,
        "extra": "ignore"
    }

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins string to list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
