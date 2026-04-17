"""
End-to-End Smoke Test for the Instagram ETL Pipeline.

This test simulates the full cycle completely offline:
Extractor: Mocks Instagram API -> Mocks CMS Upload -> Pushes to Queue Mock
Transformer: Mocks DB Queue Fetch -> Mocks LLM -> Mocks CMS Page Creation
"""

import pytest
import responses
import json
from pathlib import Path
from unittest.mock import MagicMock

from scripts.instagram_sync.config import SyncConfig
from scripts.instagram_sync.entrypoint import run_extractor, run_transformer


@pytest.fixture
def sync_config(tmp_path: Path):
    return SyncConfig(
        cms_base_url="http://mock-cms:3000",
        download_dir=tmp_path / "downloads",
        checkpoint_dir=tmp_path / "state",
        log_dir=tmp_path / "logs",
        dry_run=False,
    )


@responses.activate
def test_full_etl_pipeline_success(sync_config, monkeypatch, make_post, make_raw_job):
    """
    Step 1: Extractor pushes a downloaded post to the DB Queue.
    Step 2: Transformer reads it from DB Queue, maps via LLM, and creates CMS page.
    """
    
    # --- MOCK EXTRACTOR INPUTS ---
    fake_post = make_post(
        shortcode="E2E_SYNC",
        caption="A beautiful party\nLots of dancing",
        num_photos=1
    )
    
    class FakeInstaloaderNode:
        def __init__(self, sp):
            import datetime
            self.shortcode = sp.shortcode
            self.is_video = sp.is_video
            self.typename = "GraphImage"
            self.owner_username = sp.profile_name
            self.url = "http://fake.cdn/photo.jpg"
            self.caption = sp.caption
            self.date_utc = datetime.datetime.now(datetime.timezone.utc)
            self.caption_hashtags = []
        def get_sidecar_nodes(self):
            return []

    import scripts.instagram_sync.downloader as dl
    import time
    fake_profile = MagicMock()
    fake_profile.get_posts.return_value = [FakeInstaloaderNode(fake_post)]
    monkeypatch.setattr(dl.instaloader.Profile, "from_username", lambda *a: fake_profile)
    # Mock media download so we don't attempt real network I/O
    monkeypatch.setattr(dl.IGDownloader, "_process_post", lambda self, p: fake_post)
    monkeypatch.setattr(time, "sleep", lambda x: None)

    responses.add(
        responses.GET,
        "http://mock-cms:3000/api/sync/jobs",
        json={"status": "ok"},
        status=200,
    )
    responses.add(
        responses.GET,
        "http://mock-cms:3000/api/sync/check-shortcode",
        json={"exists": False},
        status=200,
    )
    responses.add(
        responses.POST,
        "http://mock-cms:3000/api/sync/upload",
        json={"url": "/uploads/e2e-photo.jpg"},
        status=200,
    )
    responses.add(
        responses.POST,
        "http://mock-cms:3000/api/sync/queue",
        json={"success": True},
        status=200,
    )

    # Run Phase 1
    import datetime
    last_timestamp = 0
    run_extractor("test_profile", sync_config)

    # Wait, we must make sure responses had the calls.
    # We will just verify it called queue POST.
    queue_push_call = None
    for call in responses.calls:
        if call.request.method == "POST" and "queue" in call.request.url:
            queue_push_call = call
            break
            
    assert queue_push_call is not None
    pushed_payload = json.loads(queue_push_call.request.body)
    assert pushed_payload["shortcode"] == "E2E_SYNC"

    # --- MOCK API RESPONSES FOR TRANSFORMER ---
    fake_job = make_raw_job(shortcode="E2E_SYNC", caption=fake_post.caption, num_photos=1)
    
    # We yield the job on the first loop, and empty on the second.
    responses.add(
        responses.GET,
        "http://mock-cms:3000/api/sync/queue",
        json={"job": fake_job},
        status=200,
    )
    responses.add(
        responses.GET,
        "http://mock-cms:3000/api/sync/queue",
        json={"job": None},
        status=200,
    )
    # LLM Mock
    responses.add(
        responses.POST,
        "https://openrouter.ai/api/v1/chat/completions",
        json={
            "choices": [
                {
                    "message": {
                        "content": json.dumps({"chunks": ["### A beautiful party", "Lots of dancing"]})
                    }
                }
            ]
        },
        status=200,
    )
    # Create page Mock
    responses.add(
        responses.POST,
        "http://mock-cms:3000/api/sync/pages",
        json={"id": "page-1", "slug": "e2e-sync", "title": "A beautiful party"},
        status=201,
    )
    # Update Job Mock
    responses.add(
        responses.PATCH,
        "http://mock-cms:3000/api/sync/queue",
        json={"success": True},
        status=200,
    )

    # Run Phase 2
    run_transformer(sync_config)

    # Requests after the first 3 (Phase 1): Fetch, LLM, Create, Update, Fetch(Empty)
    # Ensure update API was called
    update_call = None
    for call in responses.calls:
        if call.request.method == "PATCH" and "queue" in call.request.url:
            update_call = call
            break

    assert update_call is not None
    update_payload = json.loads(update_call.request.body)
    assert update_payload["status"] == "COMPLETED"


@responses.activate
def test_etl_transformer_crash(sync_config, make_raw_job):
    """
    If the worker crashes, the queue job is marked as ERROR.
    """
    fake_job = make_raw_job(shortcode="CRASH", caption="fail", num_photos=1)
    fake_job["mediaUrls"] = "invalid_json[" # Corrupt JSON to trigger crash in `map_job`

    responses.add(
        responses.GET,
        "http://mock-cms:3000/api/sync/jobs",
        json={"status": "ok"},
        status=200,
    )
    responses.add(
        responses.GET,
        "http://mock-cms:3000/api/sync/queue",
        json={"job": fake_job},
        status=200,
    )
    responses.add(
        responses.GET,
        "http://mock-cms:3000/api/sync/queue",
        json={"job": None},
        status=200,
    )
    responses.add(
        responses.PATCH,
        "http://mock-cms:3000/api/sync/queue",
        json={"success": True},
        status=200,
    )

    run_transformer(sync_config)

    patch_call = None
    for call in responses.calls:
        if call.request.method == "PATCH" and "queue" in call.request.url:
            patch_call = call
            break

    assert patch_call is not None
    patch_payload = json.loads(patch_call.request.body)
    
    assert patch_payload["status"] == "ERROR"
    assert "JSON" in patch_payload["errorMessage"] or "Expecting" in patch_payload["errorMessage"]
