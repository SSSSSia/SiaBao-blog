# -*- coding: utf-8 -*-
"""AI summary generation service using LangChain."""
import os
from typing import Optional

from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI

from app.core.config import get_settings

settings = get_settings()

MAX_SUMMARY_SOURCE_CHARS = 12000


def _prepare_summary_content(content: str) -> str:
    """Keep summary prompts bounded so cloud requests finish predictably."""
    normalized = (content or "").strip()
    if len(normalized) <= MAX_SUMMARY_SOURCE_CHARS:
        return normalized
    return f"{normalized[:MAX_SUMMARY_SOURCE_CHARS]}\n\n[Content truncated for summary generation.]"


def get_ai_model() -> BaseChatModel:
    """
    Get AI model instance for summary generation.

    Returns:
        BaseChatModel: Configured AI model instance
    """
    api_key = settings.siliconflow_api_key or os.getenv("SILICONFLOW_API_KEY")

    if not api_key:
        raise ValueError(
            "SiliconFlow API key not configured. "
            "Please set SILICONFLOW_API_KEY in environment or .env file."
        )

    return ChatOpenAI(
        model=settings.siliconflow_model,
        base_url=settings.siliconflow_base_url,
        api_key=api_key,
        temperature=0.7,
        max_tokens=512,
        timeout=120.0,  # Increased timeout for AI generation
    )


async def generate_summary(title: str, content: str) -> str:
    """
    Generate AI summary for an article.

    Args:
        title: Article title
        content: Article content

    Returns:
        str: Generated summary (50-100 characters)

    Raises:
        ValueError: If API key is not configured
        Exception: If summary generation fails
    """
    try:
        model = get_ai_model()

        summary_source = _prepare_summary_content(content)

        # Create prompt for summary generation
        prompt = f"""请为以下文章生成一个简短的摘要（50-100字）：

标题：{title}

内容：{summary_source}

要求：
1. 突出文章的核心观点和要点
2. 语言简洁明了
3. 长度严格控制在50字以内
4. 使用中文回答

摘要："""

        # Generate summary
        response = await model.ainvoke(prompt)

        # Clean up the response
        summary = response.content.strip()

        # Remove common prefixes if any
        if summary.startswith("摘要："):
            summary = summary[3:].strip()
        elif summary.startswith("摘要:"):
            summary = summary[3:].strip()

        # Ensure summary is within reasonable length
        if len(summary) > 200:
            summary = summary[:200] + "..."

        return summary

    except ValueError as e:
        # Re-raise configuration errors
        raise e
    except Exception as e:
        # Log and wrap other errors
        raise Exception(f"Failed to generate summary: {str(e)}")
