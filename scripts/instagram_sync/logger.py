import logging
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from contextvars import ContextVar

# Correlation ID for tracing a single post through all pipeline stages
_correlation_id: ContextVar[str] = ContextVar("correlation_id", default="global")

# Max total log size on disk (~200MB)
MAX_TOTAL_LOG_BYTES = 200 * 1024 * 1024


def set_correlation_id(shortcode: str) -> None:
    """Set the correlation ID for the current context (typically a post shortcode)."""
    _correlation_id.set(shortcode)


def get_correlation_id() -> str:
    """Get the current correlation ID."""
    return _correlation_id.get()


class JSONFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
            "correlation_id": _correlation_id.get(),
            "msg": record.getMessage(),
        }
        if record.exc_info and record.exc_info[1]:
            entry["exception"] = {
                "type": type(record.exc_info[1]).__name__,
                "message": str(record.exc_info[1]),
            }
        if hasattr(record, "extra_data"):
            entry["data"] = record.extra_data
        return json.dumps(entry, ensure_ascii=False)


def _cleanup_old_logs(log_dir: Path, prefix: str = "ig_sync_") -> None:
    """
    Remove oldest log files when total size exceeds MAX_TOTAL_LOG_BYTES (~200MB).
    Keeps the newest files, removes oldest first.
    """
    log_files = sorted(
        log_dir.glob(f"{prefix}*.jsonl"),
        key=lambda f: f.stat().st_mtime,
        reverse=True,  # newest first
    )

    total_size = 0
    for log_file in log_files:
        total_size += log_file.stat().st_size
        if total_size > MAX_TOTAL_LOG_BYTES:
            log_file.unlink()


def setup_logger(log_dir: Path, name: str = "ig_sync") -> logging.Logger:
    """
    Configure and return a logger with two handlers:
    - File: JSON lines, one file per run named by launch timestamp
    - Console: human-readable format

    Old log files are cleaned up when total exceeds ~200MB.
    File naming: ig_sync_2026-04-16_01-32-02.jsonl
    """
    log_dir.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    # Prevent duplicate handlers on repeated calls
    if logger.handlers:
        return logger

    # Cleanup old logs before creating a new one
    _cleanup_old_logs(log_dir, prefix=f"{name}_")

    # File handler — one file per run, timestamped
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    log_filename = f"{name}_{timestamp}.jsonl"

    file_handler = logging.FileHandler(
        log_dir / log_filename,
        encoding="utf-8",
    )
    file_handler.setFormatter(JSONFormatter())
    file_handler.setLevel(logging.DEBUG)

    # Console handler — human-readable
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(module)s: %(message)s")
    )
    console_handler.setLevel(logging.INFO)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    logger.info(f"Log file: {log_dir / log_filename}")

    return logger
