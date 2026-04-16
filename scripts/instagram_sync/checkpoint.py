"""
Checkpoint/resume system for long-running initial syncs.

Persists processed shortcodes to a JSON file after each post,
allowing crash recovery without re-processing.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict

logger = logging.getLogger("ig_sync")


@dataclass
class CheckpointState:
    """Persistent state between pipeline runs."""

    profile: str = ""
    mode: str = "initial"
    processed_shortcodes: list[str] = field(default_factory=list)
    last_processed_shortcode: str | None = None
    total_processed: int = 0
    total_errors: int = 0
    started_at: str = ""
    last_checkpoint_at: str = ""


class CheckpointManager:
    """Manages checkpoint persistence for crash recovery."""

    def __init__(self, checkpoint_dir: Path, profile: str, mode: str):
        self.checkpoint_dir = checkpoint_dir
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.filepath = (
            self.checkpoint_dir / f"{profile}_{mode}.checkpoint.json"
        )
        self.state = self._load_or_create(profile, mode)

    def _load_or_create(self, profile: str, mode: str) -> CheckpointState:
        """Load existing checkpoint or create a fresh one."""
        if self.filepath.exists():
            try:
                data = json.loads(self.filepath.read_text(encoding="utf-8"))
                state = CheckpointState(**data)
                logger.info(
                    f"Resumed checkpoint: {state.total_processed} posts processed, "
                    f"last: {state.last_processed_shortcode}"
                )
                return state
            except (json.JSONDecodeError, TypeError) as e:
                logger.error(
                    f"Corrupt checkpoint file, starting fresh: {e}"
                )

        return CheckpointState(
            profile=profile,
            mode=mode,
            started_at=datetime.now(timezone.utc).isoformat(),
        )

    def mark_processed(self, shortcode: str) -> None:
        """Record a successfully processed shortcode and persist state."""
        self.state.processed_shortcodes.append(shortcode)
        self.state.last_processed_shortcode = shortcode
        self.state.total_processed += 1
        self._save()

    def mark_error(self, shortcode: str) -> None:
        """Record an error for a shortcode and persist state."""
        self.state.total_errors += 1
        self._save()
        logger.debug(f"Checkpoint: error marked for {shortcode}")

    def is_processed(self, shortcode: str) -> bool:
        """Check if a shortcode was already processed in this run."""
        return shortcode in self.state.processed_shortcodes

    def get_known_shortcodes(self) -> set[str]:
        """Get all known shortcodes for incremental sync stop detection."""
        return set(self.state.processed_shortcodes)

    def _save(self) -> None:
        """Persist current state to disk."""
        self.state.last_checkpoint_at = datetime.now(timezone.utc).isoformat()
        self.filepath.write_text(
            json.dumps(asdict(self.state), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def finalize(self) -> None:
        """Log final sync statistics."""
        self._save()
        logger.info(
            f"Sync complete. Processed: {self.state.total_processed}, "
            f"Errors: {self.state.total_errors}"
        )
