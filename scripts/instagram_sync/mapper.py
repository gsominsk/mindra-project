"""
Mapper: converts DownloadedPost + uploaded URLs into PageState.

Mapping rules (from Section 3 of the plan):
- Carousel: slide[0] → media-only hero, caption → media-left with slide[1],
  remaining slides → alternating media-right / media-only
- Single Reel: media-only + text-only
- Single Photo: media-only + text-only (if caption exists)
"""

import re
import logging
from .models import (
    PageState,
    PageBlock,
    BlockContent,
    BlockLayout,
    TextStyle,
    EventType,
)
from .downloader import DownloadedPost

logger = logging.getLogger("ig_sync")


def _sanitize_caption(caption: str) -> tuple[str, str]:
    """
    Extract title (first line) and body (rest, with hashtags removed).

    Returns:
        (title, body) tuple. Title is capped at 200 chars.
    """
    lines = caption.strip().split("\n")
    title = (lines[0].strip() if lines else "Untitled Event")[:200]

    # Body: everything after the first line
    body_lines = lines[1:] if len(lines) > 1 else []

    # Remove lines that are only hashtags
    body = "\n".join(
        line for line in body_lines if not re.match(r"^[#\s]+$", line)
    ).strip()

    # Remove remaining inline hashtags
    body = re.sub(r"#\w+", "", body).strip()

    return title, body


def map_post(post: DownloadedPost, uploaded_urls: list[str]) -> PageState:
    """
    Main dispatcher: selects mapping strategy based on content type.

    Args:
        post: Downloaded post with metadata
        uploaded_urls: List of CMS media URLs (from upload API)

    Returns:
        Validated PageState ready for CMS submission
    """
    if len(post.media_files) > 1:
        page = _map_carousel(post, uploaded_urls)
    elif post.is_video:
        page = _map_reel(post, uploaded_urls)
    else:
        page = _map_photo(post, uploaded_urls)

    strategy = (
        "carousel"
        if len(post.media_files) > 1
        else "reel" if post.is_video else "photo"
    )
    logger.info(
        f"Mapped {post.shortcode} → {len(page.blocks)} blocks (strategy: {strategy})"
    )

    return page


def _map_carousel(post: DownloadedPost, urls: list[str]) -> PageState:
    """
    Carousel (≥2 media) → blocks per plan rules:
    - Slide 0: media-only (hero banner)
    - Caption + Slide 1: media-left (if both exist)
    - Slides 2+: alternating media-right / media-only
    """
    title, body = _sanitize_caption(post.caption)
    blocks: list[PageBlock] = []

    # Block 1: Hero — first slide fullscreen
    blocks.append(
        PageBlock(
            layout=BlockLayout.MEDIA_ONLY,
            content=BlockContent(
                mediaUrl=urls[0],
                mediaType="video" if post.media_types[0] == "video" else "image",
            ),
        )
    )

    # Block 2: Caption + second slide
    if body and len(urls) > 1:
        blocks.append(
            PageBlock(
                layout=BlockLayout.MEDIA_LEFT,
                content=BlockContent(
                    text=body,
                    textStyle=TextStyle(align="left", size="lg", family="sans"),
                    mediaUrl=urls[1],
                    mediaType=(
                        "video" if post.media_types[1] == "video" else "image"
                    ),
                ),
            )
        )
    elif body:
        blocks.append(
            PageBlock(
                layout=BlockLayout.TEXT_ONLY,
                content=BlockContent(
                    text=body,
                    textStyle=TextStyle(align="center", size="xl", family="sans"),
                ),
            )
        )

    # Remaining slides: alternate media-right / media-only
    start_idx = 2 if body and len(urls) > 1 else 1
    layouts_cycle = [BlockLayout.MEDIA_RIGHT, BlockLayout.MEDIA_ONLY]

    for i, url in enumerate(urls[start_idx:]):
        layout = layouts_cycle[i % len(layouts_cycle)]
        media_type = (
            "video"
            if post.media_types[start_idx + i] == "video"
            else "image"
        )

        if layout == BlockLayout.MEDIA_ONLY:
            blocks.append(
                PageBlock(
                    layout=layout,
                    content=BlockContent(mediaUrl=url, mediaType=media_type),
                )
            )
        else:
            # media-right: text left empty for manual fill in CMS
            blocks.append(
                PageBlock(
                    layout=layout,
                    content=BlockContent(
                        text="", mediaUrl=url, mediaType=media_type
                    ),
                )
            )

    return PageState(
        title=title,
        eventType=EventType.UNCATEGORIZED,
        blocks=blocks,
        igShortcode=post.shortcode,
        igSourceType=post.source_type,
        igProfileName=post.profile_name,
    )


def _map_reel(post: DownloadedPost, urls: list[str]) -> PageState:
    """Single Reels → media-only + text-only."""
    title, body = _sanitize_caption(post.caption)
    blocks: list[PageBlock] = [
        PageBlock(
            layout=BlockLayout.MEDIA_ONLY,
            content=BlockContent(mediaUrl=urls[0], mediaType="video"),
        ),
    ]

    if body:
        blocks.append(
            PageBlock(
                layout=BlockLayout.TEXT_ONLY,
                content=BlockContent(
                    text=body,
                    textStyle=TextStyle(
                        align="center", size="2xl", family="sans", bold=True
                    ),
                ),
            )
        )

    return PageState(
        title=title,
        eventType=EventType.UNCATEGORIZED,
        blocks=blocks,
        igShortcode=post.shortcode,
        igSourceType="reel",
        igProfileName=post.profile_name,
    )


def _map_photo(post: DownloadedPost, urls: list[str]) -> PageState:
    """Single photo → media-only + text-only (if caption exists)."""
    title, body = _sanitize_caption(post.caption)
    blocks: list[PageBlock] = [
        PageBlock(
            layout=BlockLayout.MEDIA_ONLY,
            content=BlockContent(mediaUrl=urls[0], mediaType="image"),
        ),
    ]

    if body:
        blocks.append(
            PageBlock(
                layout=BlockLayout.TEXT_ONLY,
                content=BlockContent(
                    text=body,
                    textStyle=TextStyle(
                        align="center", size="xl", family="sans"
                    ),
                ),
            )
        )

    return PageState(
        title=title,
        eventType=EventType.UNCATEGORIZED,
        blocks=blocks,
        igShortcode=post.shortcode,
        igSourceType="post",
        igProfileName=post.profile_name,
    )
