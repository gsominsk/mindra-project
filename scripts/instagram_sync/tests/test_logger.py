"""Tests for logger.py — timestamped log files, JSON format, correlation ID, cleanup."""

import json
import logging
from pathlib import Path

from scripts.instagram_sync.logger import (
    setup_logger,
    set_correlation_id,
    get_correlation_id,
    _cleanup_old_logs,
    JSONFormatter,
)


def test_creates_timestamped_file(tmp_path: Path):
    """Log file is created with timestamp in name: ig_sync_YYYY-MM-DD_HH-MM-SS.jsonl."""
    logger = setup_logger(tmp_path, name="test_log")
    logger.info("hello")

    # Force flush
    for h in logger.handlers:
        h.flush()

    log_files = list(tmp_path.glob("test_log_*.jsonl"))
    assert len(log_files) == 1
    assert "test_log_" in log_files[0].name
    assert log_files[0].name.endswith(".jsonl")

    # Cleanup handlers to avoid interference
    logger.handlers.clear()


def test_json_format(tmp_path: Path):
    """Each log line is valid JSON with required fields."""
    logger = setup_logger(tmp_path, name="test_json")
    logger.info("test message")

    for h in logger.handlers:
        h.flush()

    log_files = list(tmp_path.glob("test_json_*.jsonl"))
    content = log_files[0].read_text(encoding="utf-8").strip()

    # May have multiple lines (the "Log file:" line + our "test message")
    for line in content.split("\n"):
        data = json.loads(line)
        assert "ts" in data
        assert "level" in data
        assert "module" in data
        assert "correlation_id" in data
        assert "msg" in data

    logger.handlers.clear()


def test_correlation_id(tmp_path: Path):
    """set_correlation_id changes the ID in subsequent log entries."""
    logger = setup_logger(tmp_path, name="test_corr")
    set_correlation_id("ABC123")
    logger.info("correlated message")

    for h in logger.handlers:
        h.flush()

    log_files = list(tmp_path.glob("test_corr_*.jsonl"))
    lines = log_files[0].read_text(encoding="utf-8").strip().split("\n")

    # Find our specific message
    found = False
    for line in lines:
        data = json.loads(line)
        if data["msg"] == "correlated message":
            assert data["correlation_id"] == "ABC123"
            found = True

    assert found, "Correlated message not found in log"

    # Reset
    set_correlation_id("global")
    logger.handlers.clear()


def test_cleanup_old_logs(tmp_path: Path):
    """Old log files are deleted when total exceeds 200MB."""
    # Create 10 fake log files, each ~30MB → 300MB total
    for i in range(10):
        f = tmp_path / f"ig_sync_{i:04d}.jsonl"
        f.write_bytes(b"x" * (30 * 1024 * 1024))

    _cleanup_old_logs(tmp_path, prefix="ig_sync_")

    remaining = list(tmp_path.glob("ig_sync_*.jsonl"))
    total_size = sum(f.stat().st_size for f in remaining)

    # Should be under 200MB
    assert total_size <= 200 * 1024 * 1024
    # Should have deleted some files
    assert len(remaining) < 10


def test_no_duplicate_handlers(tmp_path: Path):
    """Calling setup_logger twice doesn't duplicate handlers."""
    logger1 = setup_logger(tmp_path, name="test_dup")
    handler_count = len(logger1.handlers)

    logger2 = setup_logger(tmp_path, name="test_dup")
    assert len(logger2.handlers) == handler_count
    assert logger1 is logger2

    logger1.handlers.clear()
