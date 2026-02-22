"""Site configuration service layer for managing homepage settings."""
import json
import logging
from pathlib import Path

from app.schemas.site_config import SiteConfigUpdate

logger = logging.getLogger(__name__)

# Configuration file
CONFIG_FILE = Path(__file__).parent.parent.parent / "data" / "site_config.json"


def _load_config() -> dict:
    """Load site configuration from file."""
    if not CONFIG_FILE.exists():
        # Return default configuration
        return {
            "featured_article_ids": [],
            "recent_articles_count": 6,
            "user_profile": {
                "name": "",
                "title": "",
                "bio": "",
                "avatar": "",
                "location": "",
                "joined_date": "",
                "email": "",
                "github": "",
                "gitee": "",
                "skills": [],
            },
        }
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_config(config: dict):
    """Save site configuration to file."""
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


async def get_site_config() -> dict:
    """
    Get site configuration.

    Returns:
        Site configuration dict
    """
    return _load_config()


async def update_site_config(config_data: SiteConfigUpdate) -> dict:
    """
    Update site configuration.

    Args:
        config_data: Configuration update data

    Returns:
        Updated configuration dict
    """
    current_config = _load_config()

    # Update fields if provided
    if config_data.featured_article_ids is not None:
        current_config["featured_article_ids"] = config_data.featured_article_ids

    if config_data.recent_articles_count is not None:
        current_config["recent_articles_count"] = config_data.recent_articles_count

    if config_data.user_profile is not None:
        user_profile_data = config_data.user_profile.model_dump()
        current_config["user_profile"] = user_profile_data

    # Save updated configuration
    _save_config(current_config)

    # Always cleanup old avatar files in general directory when user_profile is updated
    # This ensures orphaned files are cleaned up even if the avatar hasn't changed
    if config_data.user_profile is not None:
        current_avatar = current_config.get("user_profile", {}).get("avatar")

        try:
            from app.services.image_cleanup import cleanup_old_avatar
            cleanup_result = cleanup_old_avatar(current_avatar)
            if cleanup_result["deleted_count"] > 0:
                logger.info(
                    f"Cleaned up {cleanup_result['deleted_count']} old avatar(s), "
                    f"freed {cleanup_result['freed_space_mb']} MB"
                )
        except Exception as e:
            # Don't fail the config update if cleanup fails
            logger.warning(f"Failed to cleanup old avatar: {e}")

    return current_config
