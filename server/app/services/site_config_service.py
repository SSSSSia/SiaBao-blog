"""Site configuration service layer for managing homepage settings."""
import json
from pathlib import Path

from app.schemas.site_config import SiteConfigUpdate

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
        current_config["user_profile"] = config_data.user_profile.model_dump()

    # Save updated configuration
    _save_config(current_config)

    return current_config
