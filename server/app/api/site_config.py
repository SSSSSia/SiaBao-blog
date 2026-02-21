"""Site configuration API routes."""
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_admin_user
from app.core import R
from app.schemas.site_config import SiteConfigUpdate
from app.services.site_config_service import (
    get_site_config,
    update_site_config,
)

router = APIRouter(prefix="/config", tags=["Site Configuration"])


@router.get("")
async def get_config() -> R:
    """Get site configuration."""
    config = await get_site_config()
    return R.ok(data=config)


@router.put("")
async def update_config(
    config_data: SiteConfigUpdate,
    _admin: Annotated[dict, Depends(get_admin_user)],
) -> R:
    """Update site configuration (admin only)."""
    config = await update_site_config(config_data)
    return R.ok(message="配置更新成功", data=config)
