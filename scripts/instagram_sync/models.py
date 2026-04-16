"""
Pydantic models — mirrors of TypeScript types from app/admin/types.ts
with business validation rules.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
from enum import Enum


class EventType(str, Enum):
    BUSINESS = "business"
    WEDDING = "wedding"
    PARTY = "party"
    UNCATEGORIZED = "uncategorized"


class BlockLayout(str, Enum):
    MEDIA_LEFT = "media-left"
    MEDIA_RIGHT = "media-right"
    MEDIA_ONLY = "media-only"
    TEXT_ONLY = "text-only"


class TextStyle(BaseModel):
    align: Literal["left", "center", "right", "justify"] = "left"
    size: Literal["sm", "base", "lg", "xl", "2xl", "4xl"] = "base"
    family: Literal["sans", "serif", "mono"] = "sans"
    bold: bool = False
    italic: bool = False
    color: str = "#333333"

    @field_validator("color")
    @classmethod
    def validate_hex_color(cls, v: str) -> str:
        if not v.startswith("#") or len(v) not in (4, 7):
            raise ValueError(f"Invalid hex color: {v}")
        return v


class BlockContent(BaseModel):
    text: str = ""
    textStyle: TextStyle = Field(default_factory=TextStyle)
    mediaUrl: Optional[str] = None
    mediaType: Optional[Literal["image", "video"]] = None

    @field_validator("mediaUrl")
    @classmethod
    def validate_media_url(cls, v: Optional[str]) -> Optional[str]:
        if v and not v.startswith("/uploads/"):
            raise ValueError(f"mediaUrl must start with /uploads/, got: {v}")
        return v


class PageBlock(BaseModel):
    layout: BlockLayout
    content: BlockContent

    def model_post_init(self, __context) -> None:
        """Business rules: media-only must have media, text-only must have text."""
        if self.layout == BlockLayout.MEDIA_ONLY and not self.content.mediaUrl:
            raise ValueError("media-only block must have a mediaUrl")
        if self.layout == BlockLayout.TEXT_ONLY and not self.content.text:
            raise ValueError("text-only block must have text content")


class PageState(BaseModel):
    """Complete page payload sent to POST /api/admin/pages."""

    title: str = Field(min_length=1, max_length=200)
    eventType: EventType = EventType.UNCATEGORIZED
    blocks: list[PageBlock] = Field(min_length=1)
    igShortcode: Optional[str] = None
    igSourceType: Optional[Literal["post", "highlight", "reel"]] = None
    igProfileName: Optional[str] = None
    createdAt: Optional[str] = None


class UploadResponse(BaseModel):
    """Response from POST /api/upload."""

    url: str


class PageResponse(BaseModel):
    """Response from POST /api/admin/pages."""

    id: str
    slug: str
    title: str
