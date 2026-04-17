#!/usr/bin/env python3
"""
Instagram → Mindra CMS Sync Pipeline (ETL Split)

Usage:
    # Mode 1: Extractor (Download & Upload media, push to DB Queue)
    python -m scripts.instagram_sync.entrypoint --mode fetch --profile target_account

    # Mode 2: Transformer (Read from DB Queue, map with LLM, create CMS pages)
    python -m scripts.instagram_sync.entrypoint --mode process-queue

    # Dry run
    python -m scripts.instagram_sync.entrypoint --mode fetch --profile target_account --dry-run
"""
from __future__ import annotations

import argparse
import sys
import logging
import json
import os
from datetime import datetime, timezone

from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(usecwd=True))

from .config import SyncConfig
from .logger import setup_logger, set_correlation_id
from .downloader import IGDownloader, DownloadedPost, InstagramRateLimitError
from .mapper import map_job
from .uploader import MindraCMSAPI, CMSApiError
from .checkpoint import CheckpointManager

logger: logging.Logger = logging.getLogger("ig_sync")


def run_extractor(profile: str, config: SyncConfig) -> None:
    """Mode: --mode fetch — download posts and push to queue."""
    downloader = IGDownloader(config)
    api = MindraCMSAPI(config)
    
    try:
        api.ping()
    except CMSApiError:
        sys.exit(1)
        
    checkpoint = CheckpointManager(config.checkpoint_dir, profile, "fetch")
    known = checkpoint.get_known_shortcodes()
    max_posts = getattr(config, "_max_posts_limit", None)
    shortcode_override = getattr(config, "_shortcode", None)

    stats = {"pushed": 0, "skipped": 0, "errors": 0}

    try:
        if shortcode_override:
            posts_iterator = [downloader.fetch_single_post(shortcode_override)]
        else:
            posts_iterator = downloader.fetch_profile_posts(
                profile,
                known_shortcodes=known,
                max_posts=max_posts,
            )
            
        for post in posts_iterator:
            set_correlation_id(post.shortcode)

            if checkpoint.is_processed(post.shortcode):
                logger.info(f"Skip {post.shortcode} — already in checkpoint")
                stats["skipped"] += 1
                continue

            # Check CMS existing to avoid queueing duplicates
            try:
                existing = api.check_shortcode_exists(post.shortcode)
                if existing:
                    logger.info(f"Skip {post.shortcode} — exists in CMS (page: {existing})")
                    checkpoint.mark_processed(post.shortcode)
                    stats["skipped"] += 1
                    continue
            except CMSApiError as e:
                logger.error(f"CMS check failed for {post.shortcode}: {e}")
                
            # Upload media files to get URLs
            uploaded_urls: list[str] = []
            try:
                for media_file in post.media_files:
                    url = api.upload_media(media_file)
                    uploaded_urls.append(url)
            except CMSApiError as e:
                logger.error(f"Upload failed for {post.shortcode}: {e}")
                stats["errors"] += 1
                checkpoint.mark_error(post.shortcode)
                continue

            # Push to RawInstagramPost Queue
            payload = {
                "shortcode": post.shortcode,
                "profileName": post.profile_name,
                "sourceType": post.source_type,
                "rawCaption": post.caption,
                "mediaUrls": uploaded_urls,
                "mediaTypes": post.media_types,
                "createdAt": datetime.fromtimestamp(post.timestamp, tz=timezone.utc).isoformat()
            }

            try:
                api.push_raw_post(payload)
                logger.info(f"✅ Pushed {post.shortcode} to DB queue")
                stats["pushed"] += 1
                checkpoint.mark_processed(post.shortcode)
            except Exception as e:
                logger.error(f"Queue push failed for {post.shortcode}: {e}")
                stats["errors"] += 1
                checkpoint.mark_error(post.shortcode)

    except InstagramRateLimitError:
        logger.critical("Hard rate limit hit. Aborting.")
    except KeyboardInterrupt:
        logger.warning("Interrupted by user.")
    finally:
        checkpoint.finalize()
        logger.info(
            f"Extractor finished. "
            f"Pushed: {stats['pushed']}, "
            f"Skipped: {stats['skipped']}, "
            f"Errors: {stats['errors']}"
        )


def run_transformer(config: SyncConfig) -> None:
    """Mode: --mode process-queue — read from DB Queue and map."""
    api = MindraCMSAPI(config)
    
    try:
        api.ping()
    except CMSApiError:
        sys.exit(1)

    # We loop until the queue is empty
    stats = {"processed": 0, "failed": 0, "empty": 0}
    
    max_jobs = getattr(config, "_max_posts_limit", None) or 100
    
    for _ in range(max_jobs):
        try:
            job = api.fetch_job_from_queue()
        except Exception as e:
            logger.error(f"Failed to fetch job: {e}")
            break

        if not job:
            logger.info("Queue is empty. No jobs to process.")
            stats["empty"] += 1
            break
            
        shortcode = job.get("shortcode")
        job_id = job.get("id")
        set_correlation_id(shortcode)
        logger.info(f"Processing job {shortcode} from queue (ID: {job_id})...")

        try:
            # 1. Map to PageState
            page_state = map_job(job)
            
            # 2. Create in CMS
            result = api.create_page(page_state)
            logger.info(f"✅ Created page: {result.title} → /{result.slug}")
            
            # 3. Mark COMPLETED
            api.update_job_status(job_id, "COMPLETED")
            stats["processed"] += 1
            
        except Exception as e:
            logger.error(f"Transformer failed for {shortcode}: {e}", exc_info=True)
            api.update_job_status(job_id, "ERROR", str(e))
            stats["failed"] += 1

    logger.info(
        f"Transformer finished. "
        f"Processed: {stats['processed']}, "
        f"Failed: {stats['failed']}"
    )


def main() -> None:
    global logger

    parser = argparse.ArgumentParser(
        description="Instagram → Mindra CMS Sync Pipeline (ETL Split)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--mode",
        choices=["fetch", "process-queue"],
        required=True,
        help="Sync mode: 'fetch' to download to DB queue, 'process-queue' to run LLM mapper from DB",
    )
    parser.add_argument(
        "--profile",
        type=str,
        help="Instagram profile username to sync (required for fetch mode)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview mode: don't upload media or mutate db states",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit the maximum number of posts/jobs to process",
    )
    parser.add_argument(
        "--cms-url", type=str, help="Override CMS base URL"
    )
    
    parser.add_argument(
        "--shortcode", type=str, help="Fetch a specific post shortcode instead of the whole profile."
    )

    args = parser.parse_args()

    config = SyncConfig(dry_run=args.dry_run)
    if args.cms_url:
        config = SyncConfig(cms_base_url=args.cms_url, dry_run=args.dry_run)

    logger = setup_logger(config.log_dir)
    config._max_posts_limit = args.limit
    config._shortcode = getattr(args, "shortcode", None)

    if args.mode == "fetch":
        if not args.profile:
            parser.error("--profile is required for fetch mode")
        run_extractor(args.profile, config)
    elif args.mode == "process-queue":
        run_transformer(config)

if __name__ == "__main__":
    main()
