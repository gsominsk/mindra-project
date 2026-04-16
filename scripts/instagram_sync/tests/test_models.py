"""Tests for models.py — Pydantic validation edge cases."""

import pytest
from pydantic import ValidationError

from scripts.instagram_sync.models import (
    TextStyle,
    BlockContent,
    BlockLayout,
    PageBlock,
    PageState,
    EventType,
)


def test_valid_page_state():
    """A well-formed PageState passes validation."""
    page = PageState(
        title="Test Event",
        eventType=EventType.PARTY,
        blocks=[
            PageBlock(
                layout=BlockLayout.MEDIA_ONLY,
                content=BlockContent(
                    mediaUrl="/uploads/test.jpg", mediaType="image"
                ),
            )
        ],
        igShortcode="ABC123",
        igSourceType="post",
        igProfileName="test",
    )
    assert page.title == "Test Event"
    assert len(page.blocks) == 1


def test_empty_title_rejected():
    """Empty title raises ValidationError."""
    with pytest.raises(ValidationError, match="String should have at least 1 character"):
        PageState(
            title="",
            blocks=[
                PageBlock(
                    layout=BlockLayout.MEDIA_ONLY,
                    content=BlockContent(
                        mediaUrl="/uploads/x.jpg", mediaType="image"
                    ),
                )
            ],
        )


def test_long_title_rejected():
    """Title over 200 chars raises ValidationError."""
    with pytest.raises(ValidationError, match="at most 200"):
        PageState(
            title="a" * 201,
            blocks=[
                PageBlock(
                    layout=BlockLayout.MEDIA_ONLY,
                    content=BlockContent(
                        mediaUrl="/uploads/x.jpg", mediaType="image"
                    ),
                )
            ],
        )


def test_empty_blocks_rejected():
    """Empty blocks list raises ValidationError."""
    with pytest.raises(ValidationError, match="at least 1"):
        PageState(title="Test", blocks=[])


def test_invalid_hex_color():
    """Non-hex color string is rejected."""
    with pytest.raises(ValidationError, match="Invalid hex color"):
        TextStyle(color="red")


def test_valid_short_hex():
    """Short hex color (#abc) is accepted."""
    style = TextStyle(color="#abc")
    assert style.color == "#abc"


def test_media_url_must_start_with_uploads():
    """mediaUrl not starting with /uploads/ is rejected."""
    with pytest.raises(ValidationError, match="must start with /uploads/"):
        BlockContent(mediaUrl="https://evil.com/x.jpg", mediaType="image")


def test_media_only_requires_media():
    """media-only layout with no mediaUrl raises ValueError."""
    with pytest.raises(ValueError, match="media-only block must have a mediaUrl"):
        PageBlock(
            layout=BlockLayout.MEDIA_ONLY,
            content=BlockContent(text="some text"),
        )


def test_text_only_requires_text():
    """text-only layout with empty text raises ValueError."""
    with pytest.raises(ValueError, match="text-only block must have text content"):
        PageBlock(
            layout=BlockLayout.TEXT_ONLY,
            content=BlockContent(text=""),
        )


def test_ig_metadata_optional():
    """Instagram metadata fields are all optional."""
    page = PageState(
        title="No IG",
        blocks=[
            PageBlock(
                layout=BlockLayout.MEDIA_ONLY,
                content=BlockContent(
                    mediaUrl="/uploads/x.jpg", mediaType="image"
                ),
            )
        ],
    )
    assert page.igShortcode is None
    assert page.igSourceType is None
    assert page.igProfileName is None
