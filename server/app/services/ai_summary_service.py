# -*- coding: utf-8 -*-
"""AI summary generation service using LangChain."""

import os

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
        str: Generated summary (70-120 characters)

    Raises:
        ValueError: If API key is not configured
        Exception: If summary generation fails
    """
    try:
        model = get_ai_model()

        summary_source = _prepare_summary_content(content)

        # Create prompt for summary generation
        prompt = f"""请为以下博客文章生成一个简短的摘要（70-120字）：

标题：{title}

内容：{summary_source}

要求：
1. 突出文章的核心观点和要点
2. 语言简洁明了
3. 长度严格控制在70-120字以内
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


def _build_node_insight_prompt(node: dict, neighbor_labels: list) -> str:
    """Build the node-insight prompt from public node metadata.

    Shared by both the non-streaming (``generate_node_insight``) and streaming
    (``generate_node_insight_stream``) paths so the two cannot drift apart.
    Only public node data is sent to the model.
    """
    label = node.get("label", "")
    category = node.get("category", "")
    desc = (node.get("desc") or "").strip()
    tags = ", ".join(node.get("tags") or [])

    blog = node.get("blog") or {}
    article_titles = [a.get("title", "") for a in (blog.get("articles") or [])[:5]]
    article_count = blog.get("articleCount", 0)

    github = node.get("github") or {}
    github_desc = (github.get("description") or "").strip()
    github_stars = github.get("stars", 0)

    neighbors = ", ".join(neighbor_labels) if neighbor_labels else "（暂无）"

    return f"""你是一位技术博客作者的知识星图向导。请根据以下节点信息，用一段话（70-150字，中文）解读这个技术/话题在作者知识体系中的位置：它是什么、为什么重要，以及它与关联节点之间的内在联系。语气自然、有洞察力，不要罗列数据，不要使用「该节点」这种机械称呼。

节点：{label}
类别：{category or "未分类"}
描述：{desc or "（无）"}
标签：{tags or "无"}
相关博客（{article_count} 篇）：{"、".join(article_titles) if article_titles else "暂无"}
GitHub：{github_desc or "无"}（{github_stars} stars）
关联节点：{neighbors}

解读："""


# Common prefixes the model sometimes echoes from the prompt's trailing「解读：」.
_INSIGHT_PREFIXES = ("解读：", "解读:", "洞察：", "洞察:")


def _strip_insight_prefix(text: str) -> str:
    """Strip a leading「解读：/ 洞察：」echo if present."""
    for prefix in _INSIGHT_PREFIXES:
        if text.startswith(prefix):
            return text[len(prefix) :].strip()
    return text


async def generate_node_insight(node: dict, neighbor_labels: list) -> str:
    """
    Generate a short AI insight for an Explore constellation node.

    Explains where this tech sits in the author's knowledge graph and why it
    connects to its neighbors — using only public node metadata (label,
    category, description, tags, related blog article titles, GitHub
    description, neighbor labels). No private/secret data is sent.

    Args:
        node: Explore graph node dict (label/category/desc/tags/blog/github).
        neighbor_labels: Human-readable labels of the node's 1-hop neighbors.

    Returns:
        str: 70-150 character Chinese insight.

    Raises:
        ValueError: If the SiliconFlow API key is not configured.
        Exception: If generation otherwise fails.
    """
    try:
        model = get_ai_model()
        prompt = _build_node_insight_prompt(node, neighbor_labels)

        response = await model.ainvoke(prompt)
        text = _strip_insight_prefix(response.content.strip())

        if len(text) > 400:
            text = text[:400].rstrip() + "…"

        return text

    except ValueError:
        raise
    except Exception as e:
        raise Exception(f"Failed to generate node insight: {str(e)}")


async def generate_node_insight_stream(node: dict, neighbor_labels: list):
    """Stream a node insight token-by-token via langchain's ``astream``.

    Yields ``str`` text deltas as the model produces them. The non-streaming
    post-processing (prefix strip / 400-char truncation) is only partially
    applicable to streaming: the prefix echo is stripped from the first
    emitted delta; truncation is left to the model's ``max_tokens`` cap. The
    caller is responsible for accumulating the full text for caching.

    Raises ``ValueError`` if the API key is unconfigured (same contract as
    ``generate_node_insight``) so the route can degrade to ``available=false``.
    """
    model = get_ai_model()
    prompt = _build_node_insight_prompt(node, neighbor_labels)

    started = False
    async for chunk in model.astream(prompt):
        delta = chunk.content
        if not delta:
            continue
        if not isinstance(delta, str):
            # Tool / structured chunks carry non-str content; skip safely.
            continue
        if not started:
            # Best-effort: strip a leading prefix echo from the first delta.
            delta = _strip_insight_prefix(delta.lstrip())
            started = True
            if not delta:
                continue
        yield delta
