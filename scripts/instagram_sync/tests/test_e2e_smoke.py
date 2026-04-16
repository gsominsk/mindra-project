"""
E2E Smoke Test — full pipeline with mock HTTP server.

Spins up a lightweight mock CMS server (stdlib http.server),
runs the pipeline with fabricated DownloadedPosts (no real Instagram),
verifies the resulting state (pages created, DLQ, checkpoint, logs),
and shuts everything down.
"""

import json
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from io import BytesIO

import pytest

from scripts.instagram_sync.config import SyncConfig
from scripts.instagram_sync.uploader import MindraCMSAPI
from scripts.instagram_sync.checkpoint import CheckpointManager
from scripts.instagram_sync.dead_letter import DeadLetterQueue
from scripts.instagram_sync.entrypoint import process_single_post
from scripts.instagram_sync.logger import setup_logger


# ---------------------------------------------------------------------------
# Mock CMS Server
# ---------------------------------------------------------------------------

class MockCMSState:
    """Shared state for the mock CMS server."""

    def __init__(self):
        self.pages: dict[str, dict] = {}  # shortcode → page data
        self.uploads: list[str] = []
        self.sync_jobs: dict[str, dict] = {}
        self.request_log: list[dict] = []
        # Error injection: set to status code to force errors
        self.next_upload_status: int = 200
        self.next_create_status: int = 201
        self.upload_fail_count: int = 0  # how many uploads should fail
        self._upload_failures_remaining: int = 0

    def inject_upload_failures(self, count: int):
        self._upload_failures_remaining = count

    def inject_create_failures(self, count: int):
        self._create_failures_remaining = count
        self.next_create_status = 500

    def reset(self):
        self.pages.clear()
        self.uploads.clear()
        self.sync_jobs.clear()
        self.request_log.clear()
        self.next_upload_status = 200
        self.next_create_status = 201
        self._upload_failures_remaining = 0


def _make_handler(state: MockCMSState):
    """Create a request handler class bound to the given state."""

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass  # Suppress stderr output

        def _read_body(self) -> bytes:
            length = int(self.headers.get("Content-Length", 0))
            return self.rfile.read(length)

        def _respond(self, status: int, data: dict):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())

        def do_GET(self):
            state.request_log.append({"method": "GET", "path": self.path})

            if self.path.startswith("/api/sync/check-shortcode"):
                code = self.path.split("code=")[1] if "code=" in self.path else ""
                if code in state.pages:
                    self._respond(200, {
                        "exists": True,
                        "id": state.pages[code]["id"],
                        "slug": state.pages[code]["slug"],
                        "title": state.pages[code]["title"],
                    })
                else:
                    self._respond(200, {"exists": False})

            elif self.path == "/api/sync/jobs":
                self._respond(200, list(state.sync_jobs.values()))
            else:
                self._respond(404, {"error": "Not found"})

        def do_POST(self):
            body = self._read_body()
            state.request_log.append({"method": "POST", "path": self.path})

            if self.path == "/api/sync/upload":
                if state._upload_failures_remaining > 0:
                    state._upload_failures_remaining -= 1
                    self._respond(500, {"error": "Injected upload failure"})
                    return

                filename = f"mock-{len(state.uploads)}.jpg"
                url = f"/uploads/{filename}"
                state.uploads.append(url)
                self._respond(200, {"url": url})

            elif self.path == "/api/sync/pages":
                try:
                    data = json.loads(body)
                except json.JSONDecodeError:
                    self._respond(400, {"error": "Invalid JSON"})
                    return

                if hasattr(state, "_create_failures_remaining") and state._create_failures_remaining > 0:
                    state._create_failures_remaining -= 1
                    self._respond(500, {"error": "Injected create failure"})
                    return

                page_id = f"page-{len(state.pages)}"
                slug = f"test-{len(state.pages)}"
                page = {"id": page_id, "slug": slug, "title": data.get("title", "?")}
                shortcode = data.get("igShortcode", "")
                if shortcode:
                    state.pages[shortcode] = page
                self._respond(201, page)

            elif self.path == "/api/sync/jobs":
                try:
                    data = json.loads(body)
                except json.JSONDecodeError:
                    data = {}
                job_id = f"job-{len(state.sync_jobs)}"
                job = {"id": job_id, "mode": data.get("mode", "?"), "status": "running"}
                state.sync_jobs[job_id] = job
                self._respond(201, job)

            else:
                self._respond(404, {"error": "Not found"})

        def do_PATCH(self):
            body = self._read_body()
            state.request_log.append({"method": "PATCH", "path": self.path})

            # PATCH /api/sync/jobs/:id
            if self.path.startswith("/api/sync/jobs/"):
                job_id = self.path.split("/")[-1]
                if job_id in state.sync_jobs:
                    try:
                        data = json.loads(body)
                    except json.JSONDecodeError:
                        data = {}
                    state.sync_jobs[job_id].update(data)
                    self._respond(200, state.sync_jobs[job_id])
                else:
                    self._respond(404, {"error": "Job not found"})
            else:
                self._respond(404, {"error": "Not found"})

    return Handler


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_cms():
    """Start a mock CMS server on a random port, yield state + URL, shutdown after."""
    state = MockCMSState()
    handler = _make_handler(state)

    server = HTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    state.base_url = f"http://127.0.0.1:{port}"
    yield state

    server.shutdown()
    thread.join(timeout=5)


@pytest.fixture
def pipeline_deps(tmp_path: Path, mock_cms):
    """Create pipeline dependencies connected to the mock CMS server."""
    config = SyncConfig(
        cms_base_url=mock_cms.base_url,
        download_dir=tmp_path / "dl",
        checkpoint_dir=tmp_path / "state",
        log_dir=tmp_path / "logs",
        dlq_dir=tmp_path / "dlq",
        dry_run=False,
    )
    api = MindraCMSAPI(config)
    checkpoint = CheckpointManager(config.checkpoint_dir, "e2e_test", "daily")
    dlq = DeadLetterQueue(config.dlq_dir, max_retries=3)
    return api, checkpoint, dlq


# ---------------------------------------------------------------------------
# E2E Tests
# ---------------------------------------------------------------------------

class TestE2ESmoke:
    """End-to-end tests with real HTTP against mock server."""

    def test_happy_path_single_post(self, mock_cms, pipeline_deps, make_post):
        """Single post fully processed → page in mock CMS."""
        api, checkpoint, dlq = pipeline_deps
        post = make_post(shortcode="E2E_OK", caption="E2E Test\nBody text")

        result = process_single_post(post, api, checkpoint, dlq)

        assert result is True
        assert "E2E_OK" in mock_cms.pages
        assert mock_cms.pages["E2E_OK"]["title"] == "E2E Test"
        assert len(mock_cms.uploads) >= 1

    def test_idempotency(self, mock_cms, pipeline_deps, make_post):
        """Same shortcode twice → second time skipped."""
        api, checkpoint, dlq = pipeline_deps
        post1 = make_post(shortcode="IDEM", caption="First")
        post2 = make_post(shortcode="IDEM", caption="First")

        r1 = process_single_post(post1, api, checkpoint, dlq)
        r2 = process_single_post(post2, api, checkpoint, dlq)

        assert r1 is True
        assert r2 is False
        assert len(mock_cms.pages) == 1

    def test_dry_run(self, tmp_path: Path, mock_cms, make_post):
        """Dry run → no uploads, no page creation."""
        config = SyncConfig(
            cms_base_url=mock_cms.base_url,
            download_dir=tmp_path / "dl",
            checkpoint_dir=tmp_path / "state",
            log_dir=tmp_path / "logs",
            dlq_dir=tmp_path / "dlq",
            dry_run=True,
        )
        api = MindraCMSAPI(config)
        post = make_post(shortcode="DRY", caption="Dry Test")

        result = process_single_post(post, api, checkpoint=None, dlq=None)

        assert result is True
        assert len(mock_cms.uploads) == 0
        assert "DRY" not in mock_cms.pages

    def test_server_error_retry_success(self, mock_cms, pipeline_deps, make_post):
        """Upload fails once (500), succeeds on retry → page created."""
        api, checkpoint, dlq = pipeline_deps
        post = make_post(shortcode="RETRY_OK", caption="Retry Test")

        # Inject 1 upload failure
        mock_cms.inject_upload_failures(1)

        result = process_single_post(post, api, checkpoint, dlq)

        assert result is True
        assert "RETRY_OK" in mock_cms.pages

    def test_upload_failure_to_dlq(self, mock_cms, pipeline_deps, make_post):
        """Upload fails 3 times → post goes to DLQ."""
        api, checkpoint, dlq = pipeline_deps
        post = make_post(shortcode="DLQ_UPLOAD", caption="DLQ Test")

        # Inject 3 failures (exhausts retries)
        mock_cms.inject_upload_failures(3)

        result = process_single_post(post, api, checkpoint, dlq)

        assert result is False
        entries = dlq.list_entries()
        assert len(entries) == 1
        assert entries[0].shortcode == "DLQ_UPLOAD"

    def test_dlq_retry_success(self, mock_cms, pipeline_deps, make_post):
        """Post in DLQ → retry succeeds → DLQ entry removed."""
        api, checkpoint, dlq = pipeline_deps
        post = make_post(shortcode="DLQ_RETRY", caption="Retry from DLQ")

        # First: fail it into DLQ
        mock_cms.inject_upload_failures(3)
        process_single_post(post, api, checkpoint, dlq)
        assert len(dlq.list_entries()) == 1

        # Now retry (no more failures injected)
        mock_cms.reset()
        post2 = make_post(shortcode="DLQ_RETRY", caption="Retry from DLQ")
        result = process_single_post(post2, api, checkpoint=None, dlq=dlq)

        assert result is True
        assert len(dlq.list_entries()) == 0  # Cleaned up on success

    def test_batch_multiple_posts(self, mock_cms, pipeline_deps, make_post):
        """3 posts in sequence → 3 pages created, checkpoint updated."""
        api, checkpoint, dlq = pipeline_deps

        for i in range(3):
            post = make_post(shortcode=f"BATCH_{i}", caption=f"Batch {i}\nBody {i}")
            result = process_single_post(post, api, checkpoint, dlq)
            assert result is True

        assert len(mock_cms.pages) == 3
        assert checkpoint.state.total_processed == 3

    def test_mixed_success_fail_skip(self, mock_cms, pipeline_deps, make_post):
        """3 posts: 1 new, 1 duplicate, 1 error → correct final state."""
        api, checkpoint, dlq = pipeline_deps

        # 1. New post → success
        post1 = make_post(shortcode="MIX_OK", caption="OK Post")
        r1 = process_single_post(post1, api, checkpoint, dlq)
        assert r1 is True

        # 2. Duplicate → skip
        post2 = make_post(shortcode="MIX_OK", caption="OK Post Again")
        r2 = process_single_post(post2, api, checkpoint, dlq)
        assert r2 is False

        # 3. Error → DLQ
        mock_cms.inject_upload_failures(3)
        post3 = make_post(shortcode="MIX_FAIL", caption="Fail Post")
        r3 = process_single_post(post3, api, checkpoint, dlq)
        assert r3 is False

        # Final state
        assert len(mock_cms.pages) == 1  # Only MIX_OK
        assert checkpoint.state.total_processed == 1  # OK (duplicate skipped by checkpoint)
        assert len(dlq.list_entries()) == 1  # MIX_FAIL
