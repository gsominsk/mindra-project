"""Tests for uploader.py — HTTP client with mocked responses."""

import responses
from pathlib import Path

from scripts.instagram_sync.config import SyncConfig
from scripts.instagram_sync.uploader import MindraCMSAPI, CMSApiError
from scripts.instagram_sync.models import PageState, PageBlock, BlockContent, BlockLayout, EventType
import pytest


def _make_api(tmp_path: Path, dry_run: bool = False) -> MindraCMSAPI:
    config = SyncConfig(
        cms_base_url="http://mock-cms:3000",
        download_dir=tmp_path / "dl",
        checkpoint_dir=tmp_path / "state",
        log_dir=tmp_path / "logs",
        dlq_dir=tmp_path / "dlq",
        dry_run=dry_run,
    )
    return MindraCMSAPI(config)


@responses.activate
def test_check_shortcode_exists_true(tmp_path: Path):
    """Shortcode exists → returns page ID."""
    responses.add(
        responses.GET,
        "http://mock-cms:3000/api/sync/check-shortcode",
        json={"exists": True, "id": "page-abc", "slug": "test-slug"},
        status=200,
    )

    api = _make_api(tmp_path)
    result = api.check_shortcode_exists("TEST123")
    assert result == "page-abc"


@responses.activate
def test_check_shortcode_exists_false(tmp_path: Path):
    """Shortcode doesn't exist → returns None."""
    responses.add(
        responses.GET,
        "http://mock-cms:3000/api/sync/check-shortcode",
        json={"exists": False},
        status=200,
    )

    api = _make_api(tmp_path)
    result = api.check_shortcode_exists("NOPE")
    assert result is None


@responses.activate
def test_upload_media_success(tmp_path: Path):
    """Successful upload returns URL."""
    responses.add(
        responses.POST,
        "http://mock-cms:3000/api/sync/upload",
        json={"url": "/uploads/uuid-test.jpg"},
        status=200,
    )

    api = _make_api(tmp_path)

    # Create a temp file to upload
    test_file = tmp_path / "test.jpg"
    test_file.write_bytes(b"\xff\xd8\xff\xe0" + b"\x00" * 50)

    url = api.upload_media(test_file)
    assert url == "/uploads/uuid-test.jpg"


@responses.activate
def test_create_page_success(tmp_path: Path):
    """Successful page creation returns PageResponse."""
    responses.add(
        responses.POST,
        "http://mock-cms:3000/api/sync/pages",
        json={"id": "page-123", "slug": "test-event-4521", "title": "Test Event"},
        status=201,
    )

    api = _make_api(tmp_path)
    page_state = PageState(
        title="Test Event",
        eventType=EventType.PARTY,
        blocks=[
            PageBlock(
                layout=BlockLayout.MEDIA_ONLY,
                content=BlockContent(mediaUrl="/uploads/x.jpg", mediaType="image"),
            )
        ],
        igShortcode="TEST",
    )

    result = api.create_page(page_state)
    assert result.id == "page-123"
    assert result.slug == "test-event-4521"


@responses.activate
def test_retry_on_500(tmp_path: Path):
    """500 on first attempt, 200 on retry → success."""
    responses.add(
        responses.POST,
        "http://mock-cms:3000/api/sync/upload",
        json={"error": "Internal Server Error"},
        status=500,
    )
    responses.add(
        responses.POST,
        "http://mock-cms:3000/api/sync/upload",
        json={"url": "/uploads/retried.jpg"},
        status=200,
    )

    api = _make_api(tmp_path)
    test_file = tmp_path / "retry.jpg"
    test_file.write_bytes(b"\xff\xd8" + b"\x00" * 50)

    url = api.upload_media(test_file)
    assert url == "/uploads/retried.jpg"
    assert len(responses.calls) == 2


@responses.activate
def test_retry_on_connection_error(tmp_path: Path):
    """ConnectionError on first attempt, success on retry."""
    import requests

    responses.add(
        responses.POST,
        "http://mock-cms:3000/api/sync/upload",
        body=requests.exceptions.ConnectionError("connection refused"),
    )
    responses.add(
        responses.POST,
        "http://mock-cms:3000/api/sync/upload",
        json={"url": "/uploads/reconnected.jpg"},
        status=200,
    )

    api = _make_api(tmp_path)
    test_file = tmp_path / "conn.jpg"
    test_file.write_bytes(b"\xff\xd8" + b"\x00" * 50)

    url = api.upload_media(test_file)
    assert url == "/uploads/reconnected.jpg"


def test_dry_run_skips_requests(tmp_path: Path):
    """dry_run=True → no HTTP requests, returns placeholder URLs."""
    api = _make_api(tmp_path, dry_run=True)

    test_file = tmp_path / "dryrun.jpg"
    test_file.write_bytes(b"\xff\xd8" + b"\x00" * 50)

    url = api.upload_media(test_file)
    assert "dry-run" in url

    # No responses registered → if it tried HTTP it would fail
