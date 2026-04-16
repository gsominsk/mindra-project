"""
Instaloader wrapper with rate-limiting, session management, and media extraction.
"""
from __future__ import annotations

import instaloader
import time
import random
import logging
from pathlib import Path
from dataclasses import dataclass
from typing import Iterator

from .config import SyncConfig
from .logger import set_correlation_id

logger = logging.getLogger("ig_sync")


class InstagramRateLimitError(Exception):
    """Raised when Instagram temporarily blocks requests (429)."""

    pass


class InstagramLoginRequiredError(Exception):
    """Raised when content requires authentication."""

    pass


@dataclass
class DownloadedPost:
    """A single downloaded post with metadata."""

    shortcode: str
    caption: str
    media_files: list[Path]  # Absolute paths to downloaded files
    media_types: list[str]  # "image" | "video" for each file
    source_type: str  # "post" | "reel" | "highlight"
    profile_name: str
    timestamp: float  # Unix timestamp of the post
    is_video: bool  # True if Reels
    hashtags: list[str]  # Extracted hashtags


class IGDownloader:
    """Downloads Instagram posts with built-in rate limiting and session management."""

    def __init__(self, config: SyncConfig):
        self.config = config
        self.loader = instaloader.Instaloader(
            download_videos=True,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False,
            post_metadata_txt_pattern="",  # No .txt sidecar files
            max_connection_attempts=3,
        )
        self._session_post_count = 0
        self._load_session()

    def _load_session(self) -> None:
        """Load cookie session for authenticated access (required for Highlights)."""
        cookie_path = Path(self.config.ig_cookie_file)
        if cookie_path.exists():
            try:
                self.loader.load_session_from_file(
                    username="__cached__", filename=str(cookie_path)
                )
                logger.info("Loaded Instagram session from cookie file")
            except Exception as e:
                logger.warning(f"Failed to load session: {e}. Proceeding without auth.")
        else:
            logger.info(
                "No cookie file found. Highlights will be unavailable."
            )

    def _rate_limit_sleep(self) -> None:
        """Randomized delay to mimic human browsing behavior."""
        delay = random.uniform(
            self.config.min_delay_seconds, self.config.max_delay_seconds
        )
        logger.debug(f"Rate limit sleep: {delay:.1f}s")
        time.sleep(delay)

    def _check_session_limit(self) -> None:
        """Force a cooldown after N posts per session to avoid bans."""
        self._session_post_count += 1
        if self._session_post_count >= self.config.posts_per_session:
            cooldown = random.uniform(3600, 5400)  # 1-1.5 hours
            logger.warning(
                f"Session limit reached ({self.config.posts_per_session} posts). "
                f"Cooling down for {cooldown / 60:.0f} minutes."
            )
            time.sleep(cooldown)
            self._session_post_count = 0

    def fetch_single_post(self, shortcode: str) -> DownloadedPost:
        """Download a single post by its shortcode."""
        set_correlation_id(shortcode)
        logger.info(f"Fetching post: {shortcode}")

        try:
            post = instaloader.Post.from_shortcode(self.loader.context, shortcode)
        except instaloader.exceptions.QueryReturnedNotFoundException:
            raise ValueError(f"Post not found: {shortcode}")
        except instaloader.exceptions.ConnectionException as e:
            if "429" in str(e) or "rate" in str(e).lower():
                raise InstagramRateLimitError(f"Rate limited on {shortcode}")
            raise

        return self._process_post(post)

    def fetch_profile_posts(
        self,
        profile_name: str,
        known_shortcodes: set[str] | None = None,
        max_posts: int | None = None,
    ) -> Iterator[DownloadedPost]:
        """
        Iterate over a profile's posts.
        For --mode daily: stops when a known shortcode is encountered.
        For --mode initial: processes all posts (with optional max_posts limit).
        """
        try:
            profile = instaloader.Profile.from_username(
                self.loader.context, profile_name
            )
        except instaloader.exceptions.ProfileNotExistsException:
            raise ValueError(f"Profile not found: {profile_name}")

        count = 0
        for post in profile.get_posts():
            # Daily mode: stop at first known post
            if known_shortcodes and post.shortcode in known_shortcodes:
                logger.info(
                    f"Hit known shortcode {post.shortcode}. "
                    f"Stopping incremental sync."
                )
                return

            if max_posts and count >= max_posts:
                logger.info(f"Reached max_posts limit: {max_posts}")
                return

            try:
                self._rate_limit_sleep()
                self._check_session_limit()
                yield self._process_post(post)
                count += 1
            except InstagramRateLimitError:
                logger.error("Rate limited! Waiting 30 min before retry...")
                time.sleep(1800)
                try:
                    yield self._process_post(post)
                    count += 1
                except InstagramRateLimitError:
                    logger.critical(
                        "Still rate limited after 30 min cooldown. Stopping."
                    )
                    raise

    def _process_post(self, post: instaloader.Post) -> DownloadedPost:
        """Download media and extract metadata from a post."""
        shortcode = post.shortcode
        set_correlation_id(shortcode)
        target_dir = self.config.download_dir / shortcode
        target_dir.mkdir(parents=True, exist_ok=True)

        media_files: list[Path] = []
        media_types: list[str] = []

        # Carousel (sidecar) or single post
        if post.typename == "GraphSidecar":
            for i, node in enumerate(post.get_sidecar_nodes()):
                ext = ".mp4" if node.is_video else ".jpg"
                filename = target_dir / f"slide_{i}{ext}"
                url = node.video_url if node.is_video else node.display_url
                self.loader.context.get_and_write_raw(url, filename)
                media_files.append(filename)
                media_types.append("video" if node.is_video else "image")
        elif post.is_video:
            filename = target_dir / "video.mp4"
            self.loader.context.get_and_write_raw(post.video_url, filename)
            media_files.append(filename)
            media_types.append("video")
        else:
            filename = target_dir / "photo.jpg"
            self.loader.context.get_and_write_raw(post.url, filename)
            media_files.append(filename)
            media_types.append("image")

        # Extract hashtags from caption
        caption = post.caption or ""
        hashtags = [
            tag.strip("#").lower()
            for tag in caption.split()
            if tag.startswith("#")
        ]

        logger.info(f"Downloaded {len(media_files)} media items for {shortcode}")

        return DownloadedPost(
            shortcode=shortcode,
            caption=caption,
            media_files=media_files,
            media_types=media_types,
            source_type=(
                "reel"
                if post.is_video and post.typename != "GraphSidecar"
                else "post"
            ),
            profile_name=post.owner_username,
            timestamp=post.date_utc.timestamp(),
            is_video=post.is_video,
            hashtags=hashtags,
        )
