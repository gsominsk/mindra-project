"""Tests for entrypoint.py — process_single_post logic with mocked deps."""

import responses
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.instagram_sync.config import SyncConfig
from scripts.instagram_sync.uploader import MindraCMSAPI, CMSApiError
from scripts.instagram_sync.checkpoint import CheckpointManager
from scripts.instagram_sync.dead_letter import DeadLetterQueue
from scripts.instagram_sync.entrypoint import process_single_post
from scripts.instagram_sync.models import PageResponse


def _make_deps(tmp_path: Path, dry_run: bool = False):
    """Create all dependencies for process_single_post."""
    config = SyncConfig(
        cms_base_url="http://mock:3000",
        download_dir=tmp_path / "dl",
        checkpoint_dir=tmp_path / "state",
        log_dir=tmp_path / "logs",
        dlq_dir=tmp_path / "dlq",
        dry_run=dry_run,
    )
    api = MindraCMSAPI(config)
    checkpoint = CheckpointManager(config.checkpoint_dir, "test", "daily")
    dlq = DeadLetterQueue(config.dlq_dir, max_retries=3)
    return api, checkpoint, dlq


@responses.activate
def test_process_single_post_success(tmp_path: Path, make_post):
    """Full successful pipeline: check → upload → map → create."""
    api, checkpoint, dlq = _make_deps(tmp_path)
    post = make_post(shortcode="OK1", caption="Success\nBody text")

    # Mock CMS responses
    responses.add(responses.GET, "http://mock:3000/api/sync/check-shortcode",
                  json={"exists": False}, status=200)
    responses.add(responses.POST, "http://mock:3000/api/sync/upload",
                  json={"url": "/uploads/mock.jpg"}, status=200)
    responses.add(responses.POST, "http://mock:3000/api/sync/pages",
                  json={"id": "p1", "slug": "success-1234", "title": "Success"}, status=201)

    result = process_single_post(post, api, checkpoint, dlq)

    assert result is True
    assert checkpoint.is_processed("OK1")
    assert len(dlq.list_entries()) == 0


@responses.activate
def test_process_single_post_skip_exists(tmp_path: Path, make_post):
    """CMS reports shortcode exists → skip, no creation."""
    api, checkpoint, dlq = _make_deps(tmp_path)
    post = make_post(shortcode="EXISTING")

    responses.add(responses.GET, "http://mock:3000/api/sync/check-shortcode",
                  json={"exists": True, "id": "old-page"}, status=200)

    result = process_single_post(post, api, checkpoint, dlq)

    assert result is False
    assert checkpoint.is_processed("EXISTING")  # marked as processed


def test_process_single_post_skip_checkpoint(tmp_path: Path, make_post):
    """Post already in checkpoint → skip without HTTP."""
    api, checkpoint, dlq = _make_deps(tmp_path)
    post = make_post(shortcode="CHECKPOINTED")

    checkpoint.mark_processed("CHECKPOINTED")

    result = process_single_post(post, api, checkpoint, dlq)

    assert result is False
    # No HTTP calls made (no responses registered, would fail if tried)


@responses.activate
def test_process_single_post_upload_fail(tmp_path: Path, make_post):
    """Upload failure → post goes to DLQ, not created."""
    api, checkpoint, dlq = _make_deps(tmp_path)
    post = make_post(shortcode="UPLOAD_FAIL")

    responses.add(responses.GET, "http://mock:3000/api/sync/check-shortcode",
                  json={"exists": False}, status=200)
    # Upload fails 3 times (retry exhausted)
    for _ in range(3):
        responses.add(responses.POST, "http://mock:3000/api/sync/upload",
                      json={"error": "fail"}, status=500)

    result = process_single_post(post, api, checkpoint, dlq)

    assert result is False
    entries = dlq.list_entries()
    assert len(entries) == 1
    assert entries[0].shortcode == "UPLOAD_FAIL"
    assert entries[0].pipeline_stage == "upload"


@responses.activate
def test_process_single_post_create_fail(tmp_path: Path, make_post):
    """Upload succeeds, but page creation fails → DLQ."""
    api, checkpoint, dlq = _make_deps(tmp_path)
    post = make_post(shortcode="CREATE_FAIL")

    responses.add(responses.GET, "http://mock:3000/api/sync/check-shortcode",
                  json={"exists": False}, status=200)
    responses.add(responses.POST, "http://mock:3000/api/sync/upload",
                  json={"url": "/uploads/ok.jpg"}, status=200)
    # Create fails 3 times
    for _ in range(3):
        responses.add(responses.POST, "http://mock:3000/api/sync/pages",
                      json={"error": "fail"}, status=500)

    result = process_single_post(post, api, checkpoint, dlq)

    assert result is False
    entries = dlq.list_entries()
    assert len(entries) == 1
    assert entries[0].pipeline_stage == "create"


def test_dlq_exhaustion_skip(tmp_path: Path, make_post):
    """Post with exhausted retries in DLQ → skipped."""
    api, checkpoint, dlq = _make_deps(tmp_path)
    dlq_dir = tmp_path / "dlq"
    dlq = DeadLetterQueue(dlq_dir, max_retries=1)

    post = make_post(shortcode="EXHAUSTED")
    # Add to DLQ and exhaust retries
    dlq.add("EXHAUSTED", "p", "post", RuntimeError("1"), "upload")
    dlq.add("EXHAUSTED", "p", "post", RuntimeError("2"), "upload")

    result = process_single_post(post, api, checkpoint=None, dlq=dlq)

    assert result is False
