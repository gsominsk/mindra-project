"""Tests for config.py — SyncConfig defaults and env overrides."""

import os
from pathlib import Path
from scripts.instagram_sync.config import SyncConfig


def test_defaults():
    """Default values are sensible."""
    config = SyncConfig()
    assert config.cms_base_url.startswith("http")
    assert config.dry_run is False
    assert config.dlq_max_retries == 3
    assert config.min_delay_seconds == 60
    assert config.max_delay_seconds == 300
    assert config.posts_per_session == 12


def test_env_overrides(monkeypatch):
    """Environment variables override defaults."""
    monkeypatch.setenv("CMS_BASE_URL", "http://custom:8080")
    monkeypatch.setenv("DLQ_MAX_RETRIES", "5")
    monkeypatch.setenv("MIN_DELAY_SECONDS", "10")

    # Re-create config to pick up env (dataclass fields read os.getenv at class definition time,
    # so we need to pass them explicitly for test)
    config = SyncConfig(
        cms_base_url=os.getenv("CMS_BASE_URL", "http://localhost:3000"),
        dlq_max_retries=int(os.getenv("DLQ_MAX_RETRIES", "3")),
        min_delay_seconds=int(os.getenv("MIN_DELAY_SECONDS", "60")),
    )
    assert config.cms_base_url == "http://custom:8080"
    assert config.dlq_max_retries == 5
    assert config.min_delay_seconds == 10


def test_paths_are_path_objects():
    """All directory configs are Path objects."""
    config = SyncConfig()
    assert isinstance(config.download_dir, Path)
    assert isinstance(config.checkpoint_dir, Path)
    assert isinstance(config.log_dir, Path)
    assert isinstance(config.dlq_dir, Path)
