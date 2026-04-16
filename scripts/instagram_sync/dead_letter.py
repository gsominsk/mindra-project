"""
Dead Letter Queue (DLQ) — persistent storage for failed posts.

Failed posts are saved to individual JSON files with error details.
They can be retried later with `--retry-dlq` flag or manually inspected.
"""

import json
import logging
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, asdict

logger = logging.getLogger("ig_sync")


@dataclass
class DLQEntry:
    """A failed post record in the dead letter queue."""

    shortcode: str
    profile_name: str
    source_type: str
    error_type: str          # Exception class name
    error_message: str       # Human-readable error description
    pipeline_stage: str      # "download" | "upload" | "map" | "create"
    retry_count: int         # How many times we've tried
    first_failed_at: str     # ISO timestamp of first failure
    last_failed_at: str      # ISO timestamp of latest failure
    caption_preview: str     # First 200 chars of caption (for manual inspection)
    media_count: int         # Number of media files in the post


class DeadLetterQueue:
    """Persists failed posts to disk for later retry or manual inspection."""

    def __init__(self, dlq_dir: Path, max_retries: int = 3):
        self.dlq_dir = dlq_dir
        self.dlq_dir.mkdir(parents=True, exist_ok=True)
        self.max_retries = max_retries

    def _entry_path(self, shortcode: str) -> Path:
        return self.dlq_dir / f"{shortcode}.dlq.json"

    def add(
        self,
        shortcode: str,
        profile_name: str,
        source_type: str,
        error: Exception,
        stage: str,
        caption: str = "",
        media_count: int = 0,
    ) -> DLQEntry:
        """
        Add a failed post to the DLQ, or update its retry count if already there.

        Returns the DLQ entry (new or updated).
        """
        now = datetime.now(timezone.utc).isoformat()
        path = self._entry_path(shortcode)

        # Check if entry already exists (retry case)
        if path.exists():
            try:
                existing = json.loads(path.read_text(encoding="utf-8"))
                entry = DLQEntry(
                    shortcode=shortcode,
                    profile_name=profile_name,
                    source_type=source_type,
                    error_type=type(error).__name__,
                    error_message=str(error)[:500],
                    pipeline_stage=stage,
                    retry_count=existing.get("retry_count", 0) + 1,
                    first_failed_at=existing.get("first_failed_at", now),
                    last_failed_at=now,
                    caption_preview=caption[:200],
                    media_count=media_count,
                )
            except (json.JSONDecodeError, KeyError):
                entry = self._new_entry(
                    shortcode, profile_name, source_type, error, stage, caption, media_count, now
                )
        else:
            entry = self._new_entry(
                shortcode, profile_name, source_type, error, stage, caption, media_count, now
            )

        # Persist to disk
        path.write_text(
            json.dumps(asdict(entry), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        logger.warning(
            f"DLQ: {shortcode} added/updated (stage: {stage}, "
            f"retry: {entry.retry_count}/{self.max_retries}, "
            f"error: {entry.error_type})"
        )

        return entry

    def _new_entry(
        self,
        shortcode: str,
        profile_name: str,
        source_type: str,
        error: Exception,
        stage: str,
        caption: str,
        media_count: int,
        now: str,
    ) -> DLQEntry:
        return DLQEntry(
            shortcode=shortcode,
            profile_name=profile_name,
            source_type=source_type,
            error_type=type(error).__name__,
            error_message=str(error)[:500],
            pipeline_stage=stage,
            retry_count=0,
            first_failed_at=now,
            last_failed_at=now,
            caption_preview=caption[:200],
            media_count=media_count,
        )

    def should_retry(self, shortcode: str) -> bool:
        """Check if a shortcode hasn't exceeded max retries."""
        path = self._entry_path(shortcode)
        if not path.exists():
            return True

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return data.get("retry_count", 0) < self.max_retries
        except (json.JSONDecodeError, KeyError):
            return True

    def remove(self, shortcode: str) -> None:
        """Remove an entry from the DLQ (e.g., after successful retry)."""
        path = self._entry_path(shortcode)
        if path.exists():
            path.unlink()
            logger.info(f"DLQ: Removed {shortcode} after successful processing")

    def list_entries(self) -> list[DLQEntry]:
        """List all entries currently in the DLQ."""
        entries = []
        for path in sorted(self.dlq_dir.glob("*.dlq.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                entries.append(DLQEntry(**data))
            except (json.JSONDecodeError, TypeError, KeyError):
                logger.warning(f"DLQ: Corrupt entry {path.name}, skipping")
        return entries

    def list_retryable(self) -> list[DLQEntry]:
        """List entries that haven't exceeded max retries."""
        return [
            entry
            for entry in self.list_entries()
            if entry.retry_count < self.max_retries
        ]

    def summary(self) -> dict[str, int]:
        """Summary stats for logging."""
        entries = self.list_entries()
        retryable = [e for e in entries if e.retry_count < self.max_retries]
        exhausted = [e for e in entries if e.retry_count >= self.max_retries]

        by_stage: dict[str, int] = {}
        for e in entries:
            by_stage[e.pipeline_stage] = by_stage.get(e.pipeline_stage, 0) + 1

        return {
            "total": len(entries),
            "retryable": len(retryable),
            "exhausted": len(exhausted),
            **{f"stage_{k}": v for k, v in by_stage.items()},
        }
