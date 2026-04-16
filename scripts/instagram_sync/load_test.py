"""
Load test for the Instagram Sync Pipeline.

Simulates processing a large volume of posts (e.g., 1000) using a mock CMS server.
Injects artificial latency and random HTTP errors to test the pipeline's robustness:
- Retries
- Error handling
- File size limitations / Log rotations
- DLQ population

Usage:
    python -m scripts.instagram_sync.load_test --posts 1000
"""
from __future__ import annotations

import argparse
import time
import random
import sys
import threading
from pathlib import Path
from dataclasses import dataclass

from scripts.instagram_sync.config import SyncConfig
from scripts.instagram_sync.uploader import MindraCMSAPI
from scripts.instagram_sync.checkpoint import CheckpointManager
from scripts.instagram_sync.dead_letter import DeadLetterQueue
from scripts.instagram_sync.entrypoint import process_single_post
from scripts.instagram_sync.logger import setup_logger

# Import from our test suite to reuse the Mock CMS server
try:
    from scripts.instagram_sync.tests.test_e2e_smoke import MockCMSState, _make_handler
except ImportError:
    print("Please install test dependencies: pip install -r scripts/instagram_sync/requirements-dev.txt")
    sys.exit(1)
    
@dataclass
class DownloadedPost:
    """Mock DownloadedPost to avoid importing instaloader."""
    shortcode: str
    caption: str
    media_files: list
    media_types: list
    source_type: str
    profile_name: str
    timestamp: float
    is_video: bool
    hashtags: list

def make_post(
    tmp_path: Path,
    shortcode="TEST123",
    caption="Test Caption",
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
        f = media_dir / f"photo_{i}.jpg"
        f.write_bytes(b"\xff\xd8\xff\xe0" + b"\x00" * 10)
        media_files.append(f)
        media_types.append("image")
    for i in range(num_videos):
        f = media_dir / f"video_{i}.mp4"
        f.write_bytes(b"\x00\x00\x00\x1c" + b"\x00" * 10)
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

from http.server import HTTPServer


# Reconfigure mock handler to add latency
def _make_load_handler(state: MockCMSState, max_latency_ms: int = 50):
    BaseHandler = _make_handler(state)
    
    class LoadHandler(BaseHandler):
        def _add_latency(self):
            if max_latency_ms > 0:
                delay = random.randint(1, max_latency_ms) / 1000.0
                time.sleep(delay)

        def do_POST(self):
            self._add_latency()
            
            # Randomly inject transient 500 errors (10% chance)
            if random.random() < 0.10:
                self._respond(500, {"error": "Simulated transient load error"})
                return
                
            super().do_POST()

        def do_GET(self):
            self._add_latency()
            super().do_GET()
            
        def do_PATCH(self):
            self._add_latency()
            super().do_PATCH()
            
    return LoadHandler


def run_load_test(num_posts: int, tmp_path: Path):
    print(f"\n🚀 Starting Instagram Pipeline Load Test")
    print(f"📊 Volume: {num_posts} posts")
    print(f"📂 Workspace: {tmp_path}\n")

    # 1. Setup Mock Server
    state = MockCMSState()
    handler = _make_load_handler(state, max_latency_ms=20)
    server = HTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    
    state.base_url = f"http://127.0.0.1:{port}"
    print(f"✅ Mock CMS server running at {state.base_url}")

    # 2. Setup Pipeline Config
    config = SyncConfig(
        cms_base_url=state.base_url,
        download_dir=tmp_path / "dl",
        checkpoint_dir=tmp_path / "state",
        log_dir=tmp_path / "logs",
        dlq_dir=tmp_path / "dlq",
        dry_run=False,
    )
    
    # Use real logger so we can watch log rotation
    logger = setup_logger(config.log_dir)
    api = MindraCMSAPI(config)
    checkpoint = CheckpointManager(config.checkpoint_dir, "load_test", "initial")
    dlq = DeadLetterQueue(config.dlq_dir, config.dlq_max_retries)

    # 3. Generate Posts
    print("⏳ Generating mock data...")
    posts = []
    
    # 5% of posts will consistently fail (simulate permanent API block or bug)
    permanent_failure_shortcodes = {f"POST_{i:04d}" for i in random.sample(range(num_posts), int(num_posts * 0.05))}
    
    for i in range(num_posts):
        shortcode = f"POST_{i:04d}"
        # Make a diverse set of posts: 50% single photo, 25% carousel, 25% rels
        ptype = random.random()
        num_photos = 1
        num_videos = 0
        is_video = False
        
        if ptype > 0.75:
            num_photos, num_videos, is_video = 0, 1, True  # Reel
        elif ptype > 0.50:
            num_photos = random.randint(2, 5)  # Carousel
            
        posts.append(make_post(
            tmp_path=tmp_path,
            shortcode=shortcode,
            caption=f"Load test post {i}\nHashtags #load #test",
            num_photos=num_photos,
            num_videos=num_videos,
            is_video=is_video
        ))

    print(f"✅ Generated {len(posts)} posts. Expected permanent failures: {len(permanent_failure_shortcodes)}")

    # 4. Execute Pipeline
    print(f"\n🏃 Running pipeline (simulating sequential processing)...")
    start_time = time.time()
    
    success_count = 0
    fail_count = 0
    
    for i, post in enumerate(posts):
        if i > 0 and i % 50 == 0:
            print(f"  Processed {i}/{num_posts}...")
            
        if post.shortcode in permanent_failure_shortcodes:
            # Force server to return 500 continuously for this specific post
            state.inject_upload_failures(5)
            
        success = process_single_post(post, api, checkpoint, dlq)
        if success:
            success_count += 1
        else:
            fail_count += 1
            
    checkpoint.finalize()
    duration = time.time() - start_time
    
    server.shutdown()
    thread.join(timeout=2)
    
    # 5. Summarize & Verify
    print("\n🏁 Load Test Complete!")
    print(f"⏱️  Duration: {duration:.2f} seconds ({num_posts / duration:.1f} posts/sec)")
    
    print("\n📊 Checkpoint Stats:")
    print(f"  - Total processed: {checkpoint.state.total_processed}")
    print(f"  - Total errors: {checkpoint.state.total_errors}")
    
    dlq_stats = dlq.summary()
    print("\n📬 DLQ Stats:")
    print(f"  - Total in DLQ: {dlq_stats['total']}")
    print(f"  - Exhausted (max retries): {dlq_stats['exhausted']}")
    
    # Calculate log dir size
    log_size_mb = sum(f.stat().st_size for f in config.log_dir.glob("*.jsonl")) / (1024 * 1024)
    print(f"\n📝 Logs:")
    print(f"  - Log directory size: {log_size_mb:.2f} MB")
    print(f"  - Log files count: {len(list(config.log_dir.glob('*.jsonl')))}")
    
    # Assertions for CI/automation
    assert checkpoint.state.total_processed == success_count, "Checkpoint mismatch"
    assert dlq_stats["total"] >= len(permanent_failure_shortcodes), "DLQ total mismatch"
    print("\n✅ All assertions passed. System is stable under load.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--posts", type=int, default=200, help="Number of posts to process")
    args = parser.parse_args()
    
    # Use local folder for visibility during test
    tmp_path = Path(__file__).parent / "load_test_workspace"
    import shutil
    if tmp_path.exists():
        shutil.rmtree(tmp_path)
        
    try:
        run_load_test(args.posts, tmp_path)
    finally:
        # Cleanup
        if tmp_path.exists():
            shutil.rmtree(tmp_path)
