# -*- coding: utf-8 -*-
"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import articles, auth, comments, health, site_config, upload
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
    yield
    # Shutdown
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
