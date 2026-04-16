"""Tests for checkpoint.py — persistence, recovery, corruption handling."""

import json
from pathlib import Path
from scripts.instagram_sync.checkpoint import CheckpointManager


def test_fresh_checkpoint(tmp_path: Path):
    """New checkpoint starts with zero processed."""
    cp = CheckpointManager(tmp_path, "test_profile", "initial")
    assert cp.state.total_processed == 0
    assert cp.state.processed_shortcodes == []


def test_mark_processed(tmp_path: Path):
    """mark_processed adds shortcode and increments counter."""
    cp = CheckpointManager(tmp_path, "test_profile", "daily")
    cp.mark_processed("ABC123")

    assert "ABC123" in cp.state.processed_shortcodes
    assert cp.state.total_processed == 1
    assert cp.state.last_processed_shortcode == "ABC123"


def test_is_processed(tmp_path: Path):
    """is_processed returns True for marked, False for unknown."""
    cp = CheckpointManager(tmp_path, "test_profile", "daily")
    cp.mark_processed("ABC123")

    assert cp.is_processed("ABC123") is True
    assert cp.is_processed("UNKNOWN") is False


def test_persistence_across_instances(tmp_path: Path):
    """Checkpoint state survives re-instantiation."""
    cp1 = CheckpointManager(tmp_path, "test_profile", "initial")
    cp1.mark_processed("POST1")
    cp1.mark_processed("POST2")
    cp1.mark_error("FAIL1")

    # New instance loads from same file
    cp2 = CheckpointManager(tmp_path, "test_profile", "initial")
    assert cp2.state.total_processed == 2
    assert cp2.state.total_errors == 1
    assert cp2.is_processed("POST1")
    assert cp2.is_processed("POST2")


def test_mark_error(tmp_path: Path):
    """mark_error increments error count but doesn't add shortcode."""
    cp = CheckpointManager(tmp_path, "test_profile", "daily")
    cp.mark_error("ERRPOST")

    assert cp.state.total_errors == 1
    assert "ERRPOST" not in cp.state.processed_shortcodes


def test_get_known_shortcodes(tmp_path: Path):
    """get_known_shortcodes returns set of all processed."""
    cp = CheckpointManager(tmp_path, "test_profile", "daily")
    cp.mark_processed("A")
    cp.mark_processed("B")
    cp.mark_processed("C")

    known = cp.get_known_shortcodes()
    assert known == {"A", "B", "C"}
    assert isinstance(known, set)


def test_corrupt_checkpoint_recovery(tmp_path: Path):
    """Corrupt checkpoint file results in fresh state, not crash."""
    filepath = tmp_path / "test_profile_initial.checkpoint.json"
    filepath.write_text("{{CORRUPT JSON!!!", encoding="utf-8")

    cp = CheckpointManager(tmp_path, "test_profile", "initial")
    assert cp.state.total_processed == 0
    assert cp.state.processed_shortcodes == []
