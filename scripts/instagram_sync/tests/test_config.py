"""Tests for config.py — Centralized configuration parsing."""

import os
from pathlib import Path
from unittest.mock import patch
from scripts.instagram_sync.config import SyncConfig


@patch.dict(os.environ, {}, clear=True)
def test_defaults():
    """Default values are set when env vars are missing."""
    config = SyncConfig()
    
    assert config.cms_base_url == "http://localhost:3000"
    assert config.default_event_type == "uncategorized"
    assert config.min_delay_seconds == 1
    assert config.max_delay_seconds == 2
    assert config.posts_per_session == 12


def test_env_overrides():
    """Environment variables or explicit kwargs override defaults."""
    config = SyncConfig(
        cms_base_url="http://custom:1234",
        ig_cookie_file="/custom/cookie",
        ig_target_profile="custom_profile",
        min_delay_seconds=10,
        posts_per_session=20
    )
    assert config.cms_base_url == "http://custom:1234"
    assert config.ig_cookie_file == "/custom/cookie"
    assert config.ig_target_profile == "custom_profile"
    assert config.min_delay_seconds == 10
    assert config.posts_per_session == 20


def test_paths_are_path_objects():
    """Ensure directory configs are pathlib.Path objects."""
    config = SyncConfig(
        cms_base_url="http://localhost",
        ig_cookie_file="test.cookie",
        ig_target_profile="test",
    )
    assert isinstance(config.download_dir, Path)
    assert isinstance(config.checkpoint_dir, Path)
    assert isinstance(config.log_dir, Path)
