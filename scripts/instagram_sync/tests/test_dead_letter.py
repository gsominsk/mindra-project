"""Tests for dead_letter.py — DLQ add/remove/retry/list/summary."""

from pathlib import Path
from scripts.instagram_sync.dead_letter import DeadLetterQueue


def _make_dlq(tmp_path: Path, max_retries: int = 3) -> DeadLetterQueue:
    dlq_dir = tmp_path / "dlq"
    return DeadLetterQueue(dlq_dir, max_retries=max_retries)


def test_add_creates_file(tmp_path: Path):
    """Adding a failed post creates a .dlq.json file."""
    dlq = _make_dlq(tmp_path)
    dlq.add("ABC", "profile", "post", RuntimeError("boom"), "upload")

    files = list(dlq.dlq_dir.glob("*.dlq.json"))
    assert len(files) == 1
    assert files[0].name == "ABC.dlq.json"


def test_add_increments_retry(tmp_path: Path):
    """Repeated add() for the same shortcode increments retry_count."""
    dlq = _make_dlq(tmp_path)

    entry1 = dlq.add("ABC", "profile", "post", RuntimeError("first"), "upload")
    assert entry1.retry_count == 0

    entry2 = dlq.add("ABC", "profile", "post", RuntimeError("second"), "upload")
    assert entry2.retry_count == 1

    entry3 = dlq.add("ABC", "profile", "post", RuntimeError("third"), "upload")
    assert entry3.retry_count == 2


def test_should_retry_within_limit(tmp_path: Path):
    """Posts below max_retries can be retried."""
    dlq = _make_dlq(tmp_path, max_retries=3)
    dlq.add("ABC", "profile", "post", RuntimeError("boom"), "upload")

    assert dlq.should_retry("ABC") is True


def test_should_retry_exhausted(tmp_path: Path):
    """Posts at or above max_retries cannot be retried."""
    dlq = _make_dlq(tmp_path, max_retries=2)
    dlq.add("ABC", "profile", "post", RuntimeError("1"), "upload")
    dlq.add("ABC", "profile", "post", RuntimeError("2"), "upload")
    dlq.add("ABC", "profile", "post", RuntimeError("3"), "upload")

    # retry_count is now 2, max_retries is 2
    assert dlq.should_retry("ABC") is False


def test_remove_deletes_file(tmp_path: Path):
    """remove() deletes the DLQ file."""
    dlq = _make_dlq(tmp_path)
    dlq.add("ABC", "profile", "post", RuntimeError("boom"), "upload")

    assert dlq._entry_path("ABC").exists()
    dlq.remove("ABC")
    assert not dlq._entry_path("ABC").exists()


def test_remove_nonexistent_no_error(tmp_path: Path):
    """remove() on a nonexistent shortcode doesn't raise."""
    dlq = _make_dlq(tmp_path)
    dlq.remove("NOPE")  # Should not raise


def test_list_entries(tmp_path: Path):
    """list_entries() returns all DLQ entries."""
    dlq = _make_dlq(tmp_path)
    dlq.add("A", "p", "post", RuntimeError("1"), "upload")
    dlq.add("B", "p", "post", RuntimeError("2"), "map")
    dlq.add("C", "p", "reel", RuntimeError("3"), "create")

    entries = dlq.list_entries()
    assert len(entries) == 3
    shortcodes = {e.shortcode for e in entries}
    assert shortcodes == {"A", "B", "C"}


def test_summary_stats(tmp_path: Path):
    """summary() returns correct counts."""
    dlq = _make_dlq(tmp_path, max_retries=2)
    dlq.add("A", "p", "post", RuntimeError("1"), "upload")  # retryable (0)
    dlq.add("B", "p", "post", RuntimeError("1"), "map")     # retryable (0)
    # Exhaust C
    dlq.add("C", "p", "post", RuntimeError("1"), "create")
    dlq.add("C", "p", "post", RuntimeError("2"), "create")
    dlq.add("C", "p", "post", RuntimeError("3"), "create")  # retry_count=2

    stats = dlq.summary()
    assert stats["total"] == 3
    assert stats["retryable"] == 2
    assert stats["exhausted"] == 1
    assert stats.get("stage_upload") == 1
    assert stats.get("stage_map") == 1
    assert stats.get("stage_create") == 1
