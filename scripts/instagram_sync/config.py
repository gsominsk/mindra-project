from dataclasses import dataclass, field
from pathlib import Path
import os
from dotenv import load_dotenv

# Load .env.sync from the same directory as this file
_env_path = Path(__file__).parent / ".env.sync"
if _env_path.exists():
    load_dotenv(_env_path)


@dataclass
class SyncConfig:
    """Centralized configuration for the Instagram sync pipeline."""

    # CMS connection (internal Docker network — no auth needed)
    cms_base_url: str = os.getenv("CMS_BASE_URL", "http://localhost:3000")

    # Instagram
    ig_cookie_file: str = os.getenv(
        "IG_COOKIE_FILE", 
        str(Path(__file__).parent / "session.cookie")
    )
    ig_target_profile: str = os.getenv("IG_TARGET_PROFILE", "")

    # Rate limiting
    min_delay_seconds: int = int(os.getenv("MIN_DELAY_SECONDS", "1"))
    max_delay_seconds: int = int(os.getenv("MAX_DELAY_SECONDS", "2"))
    posts_per_session: int = int(os.getenv("POSTS_PER_SESSION", "12"))

    # Paths
    download_dir: Path = field(
        default_factory=lambda: Path(__file__).parent / "downloads"
    )
    checkpoint_dir: Path = field(
        default_factory=lambda: Path(__file__).parent / "state"
    )
    log_dir: Path = field(default_factory=lambda: Path(__file__).parent / "logs")

    # Processing
    default_event_type: str = "uncategorized"
    dry_run: bool = False

    # LLM Settings
    llm_provider: str = os.getenv("LLM_PROVIDER", "openrouter").lower()
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    nvidia_api_key: str = os.getenv("NVIDIA_API_KEY", "")

