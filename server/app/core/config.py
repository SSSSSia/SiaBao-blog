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
    explore_github_enabled: bool = True  # GitHub Trending Agent 开关
    github_token: str = ""  # 可选；启用 5000/hr 配额（建议细粒度只读 PAT）
    explore_cache_ttl: int = 86400  # GitHub 缓存 TTL 秒（24h，懒刷新）
    explore_github_fallback_scrape: bool = (
        True  # Search API 之外，合并 github.com/trending 周榜（真·本周上升）
    )
    explore_max_nodes: int = 120  # 知识星图节点硬上限

    # Explore — 额外信号源（均默认关闭，按需开启；各自独立缓存 + 失败优雅降级）
    explore_npm_enabled: bool = False  # npm 周下载量（前端库「使用量」维度）
    explore_npm_cache_ttl: int = 86400  # npm 缓存 TTL 秒
    explore_hn_enabled: bool = False  # Hacker News 话题热度（「破圈」信号）
    explore_hn_cache_ttl: int = 21600  # HN 缓存 TTL 秒（6h，热度变化快）
    explore_feed_enabled: bool = False  # RSS/Atom 技术博客订阅（内容侧新源）
    explore_feed_cache_ttl: int = 21600  # feed 缓存 TTL 秒
    explore_star_history_enabled: bool = (
        False  # 用 stars 历史快照算周增量，作为真·trending 动量（替代脆弱 scrape）
    )

    # Explore — 权重/动量公式系数（抽配置便于调参）
    explore_blog_momentum_lambda_days: float = 60.0  # 博客动量指数衰减时间常数
    explore_github_momentum_weight: float = 0.2  # GitHub 权重中 momentum 占比

    # Explore — 后台定时刷新间隔秒（0=关闭，仅懒刷新）。默认 12h = cache_ttl/2
    explore_refresh_interval_seconds: int = 43200

    model_config = {"env_file": ".env", "case_sensitive": False, "extra": "ignore"}

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins string to list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
