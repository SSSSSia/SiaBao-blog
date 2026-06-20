# -*- coding: utf-8 -*-
"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import articles, auth, comments, explore, health, site_config, upload
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers

settings = get_settings()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print("Starting My Blog Server...")
    import asyncio

    from app.services import github_trending_service

    # Preheat the Explore GitHub trending cache (best-effort, never crashes startup)
    if settings.explore_github_enabled:
        asyncio.create_task(github_trending_service.preheat())

    # 定时后台刷新 GitHub 缓存：替代纯懒加载——无人访问时缓存也会保持新鲜，
    # 首访者不再承担刷新延迟。interval=0 关闭。复用 service 内的 _refresh_lock，
    # 与请求触发的刷新互斥。任务句柄存 app.state 便于关闭时取消。
    refresh_task = None
    interval = settings.explore_refresh_interval_seconds
    if settings.explore_github_enabled and interval > 0:
        async def _refresh_loop():
            while True:
                await asyncio.sleep(interval)
                try:
                    await github_trending_service.get_github_data(force=True)
                except Exception as e:  # noqa: BLE001 — 后台任务不得崩溃循环
                    logging.getLogger(__name__).warning(
                        "scheduled GitHub explore refresh failed: %s", e
                    )

        refresh_task = asyncio.create_task(_refresh_loop())
        app.state.explore_refresh_task = refresh_task

    yield
    # Shutdown
    if refresh_task is not None:
        refresh_task.cancel()
    print("Shutting down My Blog Server...")


# Create FastAPI app
app = FastAPI(
    title="My Blog API",
    description="Personal blog backend with authentication and article management",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Register exception handlers for unified response format
register_exception_handlers(app)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
# Include routers
app.include_router(health.router)
app.include_router(auth.router, prefix="/api")
app.include_router(articles.router, prefix="/api")
app.include_router(comments.router, prefix="/api")
app.include_router(site_config.router, prefix="/api/site")
app.include_router(explore.router, prefix="/api")
app.include_router(upload.router, prefix="/api")

# Mount static files directory
static_dir = Path(__file__).parent.parent / "public"
if static_dir.exists():
    app.mount("/public", StaticFiles(directory=str(static_dir)), name="public")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "My Blog API",
        "version": "0.1.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
