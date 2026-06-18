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

    The prompt branches on the node's origin (``sources`` / id prefix) because a
    one-size-fits-all「author's knowledge system」framing reads wrong on GitHub
    trending repos (external projects) and on structural category/language anchor
    nodes. Each branch gets its own persona and instruction.

    Within the concept/tag branch, an author-signal check (``articleCount > 0``)
    further splits the framing: a concept the author has never written about is
    described neutrally rather than passed off as part of the author's knowledge.
    """
    node_id = node.get("id", "")
    sources = node.get("sources") or []
    is_github = "github" in sources or node_id.startswith("gh:")
    is_category = node_id.startswith("cat:")
    is_language = node_id.startswith("lang:")

    label = node.get("label", "")
    category = node.get("category", "")
    tags = ", ".join(node.get("tags") or [])

    blog = node.get("blog") or {}
    article_titles = [a.get("title", "") for a in (blog.get("articles") or [])[:5]]
    article_count = blog.get("articleCount", 0)

    github = node.get("github") or {}
    github_desc = (github.get("description") or "").strip()
    github_stars = github.get("stars", 0)

    neighbors = ", ".join(neighbor_labels) if neighbor_labels else "（暂无）"

    if is_github:
        # GitHub trending 仓库是外部项目，而非作者自身知识 —— 换成生态视角，
        # 避免模型硬编「作者在使用/深入掌握」之类站不住脚的话。
        persona = "你是一位敏锐的技术趋势观察者。"
        task = (
            f"用一段话（70-150字，中文）介绍开源项目「{label}」在技术生态中的角色："
            "它是做什么的、为什么当下值得开发者关注、它如何与图中相关的技术节点呼应。"
            "语气自然、有洞察，不要罗列数据，不要说成是「作者的项目」或「作者正在使用」。"
        )
        fields = (
            f"类别：{category or '未分类'}\n"
            f"GitHub 简介：{github_desc or '（无）'}（{github_stars} stars）\n"
            f"标签：{tags or '无'}\n"
            f"关联节点：{neighbors}"
        )
    elif is_category or is_language:
        # 分类/语言锚点是结构性聚合节点，只做轻量归类说明，
        # 避免被要求「解读它在作者体系中的位置」时产生空泛/幻觉描述。
        kind = "分类" if is_category else "编程语言"
        persona = "你是技术知识星图的向导。"
        task = (
            f"用一句话（40-80字，中文）简述这个「{label}」{kind}聚类："
            "它聚合了哪些方向的内容、整体覆盖面如何。简明客观，不要夸张、不要罗列。"
        )
        fields = (
            f"{kind}：{label}\n"
            f"相关博客：{article_count} 篇\n"
            f"关联节点：{neighbors}"
        )
    else:
        # 策展概念 / 博客标签。是否套用「作者知识体系」话术，取决于作者是否真的写过它：
        # 一个概念若没有任何博客文章、仅靠策展骨架 + GitHub 仓库邻居撑着，
        # 那把它说成「作者知识体系的核心支柱」就是凭空编造 —— 应换成中性的技术解读框架。
        desc = (node.get("desc") or "").strip()
        has_author_signal = article_count > 0
        if has_author_signal:
            persona = "你是一位技术博客作者的知识星图向导。"
            task = (
                "请根据以下节点信息，用一段话（70-150字，中文）解读这个技术/话题"
                "在作者知识体系中的位置：它是什么、为什么重要，以及它与关联节点之间的内在联系。"
                "语气自然、有洞察力，不要罗列数据，不要使用「该节点」这种机械称呼。"
            )
        else:
            persona = "你是一位技术知识星图的向导。"
            task = (
                f"请用一段话（70-150字，中文）介绍「{label}」这项技术："
                "它是什么、解决了什么问题、为什么当下值得关注，"
                "以及它如何与星图中相关的开源项目/技术呼应。"
                "语气自然、客观，不要把它说成是「作者正在使用/深入研究」的内容，"
                "也不要使用「该节点」这种机械称呼。"
            )
        fields = (
            f"节点：{label}\n"
            f"类别：{category or '未分类'}\n"
            f"描述：{desc or '（无）'}\n"
            f"标签：{tags or '无'}\n"
            f"相关博客（{article_count} 篇）：{'、'.join(article_titles) if article_titles else '暂无'}\n"
            f"关联节点：{neighbors}"
        )

    return f"""{persona}

{task}

{fields}

解读："""


# Common prefixes the model sometimes echoes from the prompt's trailing「解读：」.
_INSIGHT_PREFIXES = ("解读：", "解读:", "洞察：", "洞察:")

# 统一的洞察字符上限：非流式与流式共用同一阈值，避免两条路径长度不一致。
# 中文 token 密度高，300 字符足以承载「70-150 字」目标并留余量。
MAX_INSIGHT_CHARS = 300


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

        if len(text) > MAX_INSIGHT_CHARS:
            text = text[:MAX_INSIGHT_CHARS].rstrip() + "…"

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
    emitted = 0  # 已输出字符数，用于在到达上限时优雅收尾
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
        # 到达字符上限：截断本段、补省略号后停止，与非流式路径长度一致。
        if emitted + len(delta) >= MAX_INSIGHT_CHARS:
            remaining = MAX_INSIGHT_CHARS - emitted
            if remaining > 0:
                yield delta[:remaining].rstrip()
            yield "…"
            return
        emitted += len(delta)
        yield delta
