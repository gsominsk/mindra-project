"""
Mapper: converts raw DB queue jobs into PageState using LLM formatting.
"""

import re
import logging
import uuid
import json
from datetime import datetime, timezone
from .models import (
    PageState,
    PageBlock,
    BlockContent,
    BlockLayout,
    TextStyle,
    EventType,
)
from .llm import create_llm_client
from .config import SyncConfig

logger = logging.getLogger("ig_sync")

SYSTEM_PROMPT = """You are a strict text parsing assistant. Your task is to take Instagram captions and split them logically into sequential chunks, returning ONLY a JSON object.

Rules:
1. Output MUST be a valid JSON object with exactly one key: 'chunks'.
2. 'chunks' must be a JSON array of strings.
3. Format text using Markdown (e.g., '###' for tags or subtitle blocks, '#' for titles).
4. Do NOT output markdown code block wrappers like ```json. Output raw JSON object.
5. The entire story must be preserved, just split into blocks.

Example Input:
Big Summer Party! Get your tickets now. Link in bio. #summer #party

Example Output:
{
  "chunks": [
    "### Big Summer Party!\\n\\nGet your tickets now. Link in bio.",
    "### Tags\\n\\n#summer #party"
  ]
}
"""

config = SyncConfig()
llm_client = create_llm_client(config)


def _sanitize_caption(caption: str) -> tuple[str, str]:
    """Extract title (first line) and body (rest, with hashtags removed)."""
    if not caption or not caption.strip():
        return "Untitled Event", ""
        
    lines = caption.strip().split("\n")
    title = (lines[0].strip() if lines else "Untitled Event")[:200]
    if not title:
        title = "Untitled Event"

    body_lines = lines[1:] if len(lines) > 1 else []
    body = "\n".join(
        line for line in body_lines if not re.match(r"^[#\s]+$", line)
    ).strip()
    body = re.sub(r"#\w+", "", body).strip()

    return title, body


def map_job(job: dict) -> PageState:
    """Main dispatcher for a DB worker job."""
    urls = json.loads(job.get("mediaUrls", "[]"))
    types = json.loads(job.get("mediaTypes", "[]"))
    
    if len(urls) > 1:
        page = _map_carousel_job(job, urls, types)
    elif types and types[0] == "video":
        page = _map_reel_job(job, urls, types)
    else:
        page = _map_photo_job(job, urls, types)

    strategy = "carousel" if len(urls) > 1 else "reel" if (types and types[0] == "video") else "photo"
    logger.info(f"Mapped {job.get('shortcode')} → {len(page.blocks)} blocks (strategy: {strategy}, type: {page.eventType})")
    return page


def _map_carousel_job(job: dict, urls: list[str], types: list[str]) -> PageState:
    """Skeleton + Pour layout generation using LLM Markdown chunks."""
    caption = job.get("rawCaption", "")
    title, body = _sanitize_caption(caption)
    
    # 1. Parse text into chunks via LLM
    chunks_pool = []
    if body:
        trace_id = str(uuid.uuid4())
        user_prompt = f"Parse this:\n\n{caption}"
        response = llm_client.get_analysis(SYSTEM_PROMPT, user_prompt, trace_id=trace_id)
        chunks_pool = response.get("chunks", [body])

    m_urls_pool = urls.copy()
    m_types_pool = types.copy()

    # Classification Block
    if not chunks_pool or len(urls) == 1:
        return _route_to_blog_job(title, job, m_urls_pool, m_types_pool, chunks_pool)

    # 2. ALGORITHM: Skeleton mapping
    skeleton = ['media-only']  # Slide 1 is always Hero
    m_urls_pool.pop(0)
    m_types_pool.pop(0)
    
    # We create copies for the skeleton phase to avoid draining the pour phase pools
    sk_urls = m_urls_pool.copy()
    sk_chunks = chunks_pool.copy()

    while sk_urls or sk_chunks:
        if sk_urls and sk_chunks:
            # Alternate media-left / media-right starting with left
            skeleton.append('media-left' if len(skeleton) % 2 != 0 else 'media-right')
            sk_urls.pop(0)
            sk_chunks.pop(0)
        elif sk_chunks:
            skeleton.append('text-only')
            sk_chunks.pop(0)
        elif sk_urls:
            skeleton.append('media-only')
            sk_urls.pop(0)

    # 3. ALGORITHM: Pour content
    blocks: list[PageBlock] = []
    m_urls_pour = urls.copy()
    m_types_pour = types.copy()
    chunks_pour = chunks_pool.copy()

    for s_type in skeleton:
        if s_type == 'media-only' and m_urls_pour:
            blocks.append(PageBlock(
                layout=BlockLayout.MEDIA_ONLY,
                content=BlockContent(
                    mediaUrl=m_urls_pour.pop(0),
                    mediaType="video" if m_types_pour.pop(0) == "video" else "image"
                )
            ))
        elif s_type in ['media-left', 'media-right'] and m_urls_pour and chunks_pour:
            blocks.append(PageBlock(
                layout=BlockLayout.MEDIA_LEFT if s_type == 'media-left' else BlockLayout.MEDIA_RIGHT,
                content=BlockContent(
                    text=chunks_pour.pop(0),
                    textStyle=TextStyle(align="left", size="base", family="sans"),
                    mediaUrl=m_urls_pour.pop(0),
                    mediaType="video" if m_types_pour.pop(0) == "video" else "image"
                )
            ))
        elif s_type == 'text-only' and chunks_pour:
            blocks.append(PageBlock(
                layout=BlockLayout.TEXT_ONLY,
                content=BlockContent(
                    text=chunks_pour.pop(0),
                    textStyle=TextStyle(align="left", size="base", family="sans")
                )
            ))

    # createdAt handling: job["createdAt"] might be an ISO formatted string or dict.
    # To be safe, we parse or default.
    created_at = str(job.get("createdAt", datetime.now(tz=timezone.utc).isoformat()))

    return PageState(
        title=title,
        eventType=EventType.UNCATEGORIZED,
        blocks=blocks,
        igShortcode=job.get("shortcode", "unknown"),
        igSourceType=job.get("sourceType", "post"),
        igProfileName=job.get("profileName", "unknown"),
        createdAt=created_at,
    )


def _route_to_blog_job(title, job, urls, types, chunks):
    """Fallback router for textless posts or single photos/reels to blog draft."""
    blocks = []
    for u, t in zip(urls, types):
        blocks.append(PageBlock(layout=BlockLayout.MEDIA_ONLY, content=BlockContent(mediaUrl=u, mediaType="video" if t == "video" else "image")))
    for c in chunks:
        blocks.append(PageBlock(layout=BlockLayout.TEXT_ONLY, content=BlockContent(text=c)))

    created_at = str(job.get("createdAt", datetime.now(tz=timezone.utc).isoformat()))

    return PageState(
        title=title,
        eventType=EventType.BLOG,
        blocks=blocks,
        igShortcode=job.get("shortcode", "unknown"),
        igSourceType=job.get("sourceType", "post"),
        igProfileName=job.get("profileName", "unknown"),
        createdAt=created_at,
    )

def _map_reel_job(job: dict, urls: list[str], types: list[str]) -> PageState:
    caption = job.get("rawCaption", "")
    title, body = _sanitize_caption(caption)
    return _route_to_blog_job(title, job, urls, types, [body] if body else [])

def _map_photo_job(job: dict, urls: list[str], types: list[str]) -> PageState:
    caption = job.get("rawCaption", "")
    title, body = _sanitize_caption(caption)
    return _route_to_blog_job(title, job, urls, types, [body] if body else [])
