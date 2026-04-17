"""
Shared fixtures for the Instagram sync pipeline test suite.

We avoid importing downloader.py directly (it imports instaloader),
and instead define DownloadedPost inline for test isolation.
"""

import pytest
from pathlib import Path
from dataclasses import dataclass

from scripts.instagram_sync.config import SyncConfig


@dataclass
class DownloadedPost:
    """
    Test-only mirror of downloader.DownloadedPost.
    Avoids importing instaloader and Python 3.10+ syntax issues.
    """
    shortcode: str
    caption: str
    media_files: list
    media_types: list
    source_type: str
    profile_name: str
    timestamp: float
    is_video: bool
    hashtags: list


@pytest.fixture
def tmp_config(tmp_path: Path) -> SyncConfig:
    """SyncConfig with all paths pointing to tmp_path."""
    return SyncConfig(
        cms_base_url="http://localhost:9999",
        ig_cookie_file="test.cookie",
        ig_target_profile="test_profile",
        min_delay_seconds=0,
        max_delay_seconds=0,
        posts_per_session=100,
        download_dir=tmp_path / "downloads",
        checkpoint_dir=tmp_path / "state",
        log_dir=tmp_path / "logs",
        dry_run=False,
    )


@pytest.fixture
def make_post(tmp_path: Path):
    """Factory fixture to create DownloadedPost instances with temp media files."""

    def _make(
        shortcode="TEST123",
        caption="Test Caption\nSome body text",
        num_photos=1,
        num_videos=0,
        profile_name="test_profile",
        source_type="post",
        is_video=False,
        hashtags=None,
    ):
        media_dir = tmp_path / "downloads" / shortcode
        media_dir.mkdir(parents=True, exist_ok=True)

        media_files = []
        media_types = []

        for i in range(num_photos):
            f = media_dir / "photo_{}.jpg".format(i)
            f.write_bytes(b"\xff\xd8\xff\xe0" + b"\x00" * 100)  # fake JPEG
            media_files.append(f)
            media_types.append("image")

        for i in range(num_videos):
            f = media_dir / "video_{}.mp4".format(i)
            f.write_bytes(b"\x00\x00\x00\x1c" + b"\x00" * 100)  # fake MP4
            media_files.append(f)
            media_types.append("video")

        return DownloadedPost(
            shortcode=shortcode,
            caption=caption,
            media_files=media_files,
            media_types=media_types,
            source_type=source_type,
            profile_name=profile_name,
            timestamp=1713225600.0,
            is_video=is_video or num_videos > 0,
            hashtags=hashtags or [],
        )

    return _make


@pytest.fixture
def make_raw_job():
    """Factory fixture to create RawInstagramPost dictionary matching API GET."""
    import json
    from datetime import datetime, timezone

    def _make(
        shortcode="TEST123",
        caption="Test Caption\nSome body text",
        num_photos=1,
        num_videos=0,
        profile_name="test_profile",
        source_type="post",
    ):
        media_urls = []
        media_types = []

        for i in range(num_photos):
            media_urls.append(f"/uploads/mock-photo-{i}.jpg")
            media_types.append("image")

        for i in range(num_videos):
            media_urls.append(f"/uploads/mock-video-{i}.mp4")
            media_types.append("video")

        return {
            "id": "cuid1234",
            "shortcode": shortcode,
            "profileName": profile_name,
            "sourceType": source_type,
            "rawCaption": caption,
            "mediaUrls": json.dumps(media_urls),
            "mediaTypes": json.dumps(media_types),
            "status": "PROCESSING",
            "retryCount": 0,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }

    return _make


@pytest.fixture
def mock_uploaded_urls():
    """Factory: generate mock uploaded URLs for N media files."""

    def _make(count=1):
        return ["/uploads/mock-{}.jpg".format(i) for i in range(count)]

    return _make
