#!/usr/bin/env python3
"""
Instagram → Mindra CMS Sync Pipeline

Usage:
    # Sync a single post by shortcode
    python -m scripts.instagram_sync.entrypoint --shortcode C123456

    # Daily incremental sync (new posts only)
    python -m scripts.instagram_sync.entrypoint --mode daily --profile target_account

    # Full initial sync (all posts, with checkpoint/resume)
    python -m scripts.instagram_sync.entrypoint --mode initial --profile target_account

    # Retry failed posts from the Dead Letter Queue
    python -m scripts.instagram_sync.entrypoint --retry-dlq --profile target_account

    # Dry run (no uploads, no page creation)
    python -m scripts.instagram_sync.entrypoint --mode daily --profile target_account --dry-run
"""
from __future__ import annotations

import argparse
import sys
import logging

from .config import SyncConfig
from .logger import setup_logger, set_correlation_id
from .downloader import IGDownloader, DownloadedPost, InstagramRateLimitError
from .mapper import map_post
from .uploader import MindraCMSAPI, CMSApiError
from .checkpoint import CheckpointManager
from .dead_letter import DeadLetterQueue
from .models import PageState

logger: logging.Logger = logging.getLogger("ig_sync")


def process_single_post(
    post: DownloadedPost,
    api: MindraCMSAPI,
    checkpoint: CheckpointManager | None = None,
    dlq: DeadLetterQueue | None = None,
) -> bool:
    """
    Full pipeline for a single downloaded post:
    1. Idempotency check (checkpoint + CMS shortcode lookup)
    2. Upload all media files
    3. Map to PageState (Pydantic validation)
    4. Create page in CMS
    5. Save checkpoint

    On failure: post goes to DLQ (if available) instead of being silently lost.

    Returns:
        True if a page was created, False if skipped or failed.
    """
    set_correlation_id(post.shortcode)

    # Check checkpoint first (local, fast)
    if checkpoint and checkpoint.is_processed(post.shortcode):
        logger.info(f"Skip {post.shortcode} — already in checkpoint")
        return False

    # Check DLQ: has this post exhausted retries?
    if dlq and not dlq.should_retry(post.shortcode):
        logger.info(f"Skip {post.shortcode} — DLQ max retries exhausted")
        return False

    # Check CMS (remote, idempotency)
    try:
        existing = api.check_shortcode_exists(post.shortcode)
        if existing:
            logger.info(f"Skip {post.shortcode} — exists in CMS (page: {existing})")
            if checkpoint:
                checkpoint.mark_processed(post.shortcode)
            # If in DLQ, remove it (was fixed externally)
            if dlq:
                dlq.remove(post.shortcode)
            return False
    except CMSApiError as e:
        logger.error(f"CMS check failed for {post.shortcode}: {e}")
        if dlq:
            dlq.add(post.shortcode, post.profile_name, post.source_type,
                     e, "check", post.caption, len(post.media_files))
        return False

    # Upload media files
    uploaded_urls: list[str] = []
    for media_file in post.media_files:
        try:
            url = api.upload_media(media_file)
            uploaded_urls.append(url)
        except CMSApiError as e:
            logger.error(f"Upload failed for {media_file.name}: {e}")
            if dlq:
                dlq.add(post.shortcode, post.profile_name, post.source_type,
                         e, "upload", post.caption, len(post.media_files))
            if checkpoint:
                checkpoint.mark_error(post.shortcode)
            return False

    # Map to PageState (with Pydantic validation)
    try:
        page_state: PageState = map_post(post, uploaded_urls)
    except Exception as e:
        logger.error(
            f"Mapping failed for {post.shortcode}: {e}", exc_info=True
        )
        if dlq:
            dlq.add(post.shortcode, post.profile_name, post.source_type,
                     e, "map", post.caption, len(post.media_files))
        if checkpoint:
            checkpoint.mark_error(post.shortcode)
        return False

    # Create page in CMS
    try:
        result = api.create_page(page_state)
        logger.info(f"✅ Created page: {result.title} → /{result.slug}")
        if checkpoint:
            checkpoint.mark_processed(post.shortcode)
        # Remove from DLQ on success (retry succeeded)
        if dlq:
            dlq.remove(post.shortcode)
        return True
    except CMSApiError as e:
        logger.error(f"Page creation failed for {post.shortcode}: {e}")
        if dlq:
            dlq.add(post.shortcode, post.profile_name, post.source_type,
                     e, "create", post.caption, len(post.media_files))
        if checkpoint:
            checkpoint.mark_error(post.shortcode)
        return False


def run_single_shortcode(shortcode: str, config: SyncConfig) -> None:
    """Mode: --shortcode — sync a single post."""
    downloader = IGDownloader(config)
    api = MindraCMSAPI(config)
    
    # Pre-flight check
    try:
        api.ping()
    except CMSApiError:
        sys.exit(1)
        
    dlq = DeadLetterQueue(config.dlq_dir, config.dlq_max_retries)

    try:
        post = downloader.fetch_single_post(shortcode)
    except ValueError as e:
        logger.error(f"Failed to fetch post: {e}")
        sys.exit(1)

    success = process_single_post(post, api, checkpoint=None, dlq=dlq)
    if success:
        logger.info(f"Done! Post {shortcode} synced successfully.")
    else:
        logger.warning(f"Post {shortcode} was skipped or failed.")


def run_profile_sync(
    profile: str, mode: str, config: SyncConfig
) -> None:
    """Mode: --mode initial|daily — iterate over a profile's posts."""
    downloader = IGDownloader(config)
    api = MindraCMSAPI(config)
    
    # Pre-flight check
    try:
        api.ping()
    except CMSApiError:
        sys.exit(1)
        
    checkpoint = CheckpointManager(config.checkpoint_dir, profile, mode)
    dlq = DeadLetterQueue(config.dlq_dir, config.dlq_max_retries)

    known = checkpoint.get_known_shortcodes()
    # Apply user --limit or fallback to default limits
    if getattr(config, "_max_posts_limit", None) is not None:
        max_posts = config._max_posts_limit
    else:
        max_posts = None if mode == "initial" else 50

    stats = {"created": 0, "skipped": 0, "errors": 0}

    try:
        for post in downloader.fetch_profile_posts(
            profile,
            known_shortcodes=known if mode == "daily" else None,
            max_posts=max_posts,
        ):
            try:
                success = process_single_post(post, api, checkpoint, dlq)
                if success:
                    stats["created"] += 1
                else:
                    stats["skipped"] += 1
            except Exception as e:
                logger.error(
                    f"Unexpected error processing {post.shortcode}: {e}",
                    exc_info=True,
                )
                stats["errors"] += 1
                checkpoint.mark_error(post.shortcode)
                dlq.add(post.shortcode, post.profile_name, post.source_type,
                         e, "unknown", post.caption, len(post.media_files))

    except InstagramRateLimitError:
        logger.critical(
            "Hard rate limit hit. Aborting. "
            "Will resume from checkpoint on next run."
        )
    except KeyboardInterrupt:
        logger.warning("Interrupted by user. Saving checkpoint...")
    finally:
        checkpoint.finalize()
        dlq_stats = dlq.summary()
        logger.info(
            f"Sync finished. "
            f"Created: {stats['created']}, "
            f"Skipped: {stats['skipped']}, "
            f"Errors: {stats['errors']}, "
            f"DLQ total: {dlq_stats['total']} "
            f"(retryable: {dlq_stats['retryable']}, "
            f"exhausted: {dlq_stats['exhausted']})"
        )


def run_dlq_retry(profile: str, config: SyncConfig) -> None:
    """Mode: --retry-dlq — retry all retryable posts from the DLQ."""
    downloader = IGDownloader(config)
    api = MindraCMSAPI(config)
    
    # Pre-flight check
    try:
        api.ping()
    except CMSApiError:
        sys.exit(1)
        
    dlq = DeadLetterQueue(config.dlq_dir, config.dlq_max_retries)

    entries = dlq.list_retryable()
    if not entries:
        logger.info("DLQ is empty or all entries have exhausted retries.")
        return

    logger.info(f"DLQ retry: {len(entries)} posts to retry")
    stats = {"success": 0, "failed": 0, "skipped": 0}

    for entry in entries:
        set_correlation_id(entry.shortcode)
        logger.info(
            f"DLQ retry: {entry.shortcode} "
            f"(attempt {entry.retry_count + 1}/{config.dlq_max_retries}, "
            f"last stage: {entry.pipeline_stage})"
        )

        try:
            post = downloader.fetch_single_post(entry.shortcode)
        except InstagramRateLimitError:
            logger.critical("Rate limited during DLQ retry. Stopping.")
            break
        except ValueError as e:
            logger.error(f"DLQ: Post {entry.shortcode} no longer exists: {e}")
            stats["skipped"] += 1
            continue

        success = process_single_post(post, api, checkpoint=None, dlq=dlq)
        if success:
            stats["success"] += 1
        else:
            stats["failed"] += 1

    logger.info(
        f"DLQ retry finished. "
        f"Success: {stats['success']}, "
        f"Failed: {stats['failed']}, "
        f"Skipped: {stats['skipped']}"
    )


def main() -> None:
    global logger

    parser = argparse.ArgumentParser(
        description="Instagram → Mindra CMS Sync Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --shortcode C7xK9pQ
  %(prog)s --mode daily --profile djfriend
  %(prog)s --mode initial --profile djfriend --dry-run
  %(prog)s --retry-dlq --profile djfriend
        """,
    )
    parser.add_argument(
        "--mode",
        choices=["initial", "daily"],
        help="Sync mode: 'initial' for full history, 'daily' for new posts only",
    )
    parser.add_argument(
        "--profile",
        type=str,
        help="Instagram profile username to sync",
    )
    parser.add_argument(
        "--shortcode",
        type=str,
        help="Sync a single post by its shortcode (e.g. C123456)",
    )
    parser.add_argument(
        "--retry-dlq",
        action="store_true",
        help="Retry all retryable failed posts from the Dead Letter Queue",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview mode: don't upload media or create pages",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit the maximum number of posts to process (e.g. 5 for a quick test)",
    )
    parser.add_argument(
        "--cms-url",
        type=str,
        help="Override CMS base URL (default: from .env.sync)",
    )
    args = parser.parse_args()

    # Build config
    config = SyncConfig(dry_run=args.dry_run)
    if args.cms_url:
        config = SyncConfig(
            cms_base_url=args.cms_url, dry_run=args.dry_run
        )

    # Setup logging
    logger = setup_logger(config.log_dir)
    config._max_posts_limit = args.limit

    # Dispatch
    if args.shortcode:
        run_single_shortcode(args.shortcode, config)
    elif args.retry_dlq:
        if not args.profile:
            parser.error("--retry-dlq requires --profile")
        run_dlq_retry(args.profile, config)
    elif args.profile and args.mode:
        run_profile_sync(args.profile, args.mode, config)
    else:
        parser.error(
            "Either --shortcode, --retry-dlq, or (--profile + --mode) is required"
        )


if __name__ == "__main__":
    main()
