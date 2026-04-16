"""
MindraCMSAPI — HTTP client for interacting with the Mindra CMS API.
Handles media upload, page creation, and idempotency checks with retry logic.

Uses internal /api/sync/ endpoints (not behind middleware auth).
The sync service communicates over Docker internal network.
"""

import logging
import requests
from pathlib import Path
from typing import Optional

from .config import SyncConfig
from .models import PageState, UploadResponse, PageResponse

logger = logging.getLogger("ig_sync")


class CMSApiError(Exception):
    """CMS API returned an error response."""

    def __init__(self, status_code: int, message: str, endpoint: str):
        self.status_code = status_code
        self.endpoint = endpoint
        super().__init__(f"[{status_code}] {endpoint}: {message}")


class MindraCMSAPI:
    """HTTP client for the Mindra CMS internal sync API."""

    MAX_RETRIES = 3

    def __init__(self, config: SyncConfig):
        self.base_url = config.cms_base_url.rstrip("/")
        self.session = requests.Session()
        # No auth headers — internal Docker network communication
        self.timeout = 60
        self.dry_run = config.dry_run

    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        """
        Make an HTTP request with retry logic for transient errors.

        Retry strategy:
        - 5xx errors: retry up to MAX_RETRIES
        - ConnectionError: retry up to MAX_RETRIES
        - 4xx: raise immediately (client error / bad data)
        """
        url = f"{self.base_url}{path}"
        kwargs.setdefault("timeout", self.timeout)

        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                resp = self.session.request(method, url, **kwargs)

                if resp.status_code >= 500:
                    if attempt < self.MAX_RETRIES:
                        logger.warning(
                            f"Server error {resp.status_code} on {path}, "
                            f"retry {attempt}/{self.MAX_RETRIES}"
                        )
                        continue
                    raise CMSApiError(resp.status_code, resp.text[:200], path)

                if resp.status_code >= 400:
                    raise CMSApiError(resp.status_code, resp.text[:200], path)

                return resp

            except requests.exceptions.RequestException as e:
                if attempt < self.MAX_RETRIES:
                    logger.warning(
                        f"Connection error on {path}, "
                        f"retry {attempt}/{self.MAX_RETRIES}: {e}"
                    )
                    continue
                raise CMSApiError(0, f"Connection failed: {e}", path)

        raise CMSApiError(0, "Max retries exceeded", path)

    def ping(self) -> bool:
        """
        Check if the CMS is accessible.
        
        Returns:
            True if accessible. Raises a critical error otherwise.
        """
        if self.dry_run:
            logger.info("[DRY RUN] Skipping CMS ping.")
            return True
            
        try:
            logger.info(f"Pinging CMS at {self.base_url}...")
            # Using a fast lightweight endpoint for ping, or just root if there's no health endpoint.
            # /api/sync/jobs usually returns 200 list or 404 if not found, but it won't connection refuse.
            resp = self.session.request("GET", f"{self.base_url}/api/sync/jobs", timeout=5)
            if resp.status_code < 500:
                logger.info("CMS ping successful.")
                return True
            raise CMSApiError(resp.status_code, "CMS Server Error", "/api/sync/jobs")
        except requests.exceptions.RequestException as e:
            logger.critical(f"CRITICAL ERROR: Mindra CMS is unreachable at {self.base_url}. Is it running?")
            raise CMSApiError(0, f"Connection failed: {e}", "ping") from e

    def check_shortcode_exists(self, shortcode: str) -> Optional[str]:
        """
        Check if a page with the given shortcode exists in CMS.

        Returns:
            Page ID if it exists, None otherwise.
        """
        resp = self._request(
            "GET", f"/api/sync/check-shortcode?code={shortcode}"
        )
        data = resp.json()
        if data.get("exists"):
            return data["id"]
        return None

    def upload_media(self, file_path: Path) -> str:
        """
        Upload a media file to the CMS.

        Returns:
            The /uploads/... URL of the uploaded file.
        """
        if self.dry_run:
            logger.info(f"[DRY RUN] Would upload: {file_path.name}")
            return f"/uploads/dry-run-{file_path.stem}{file_path.suffix}"

        with open(file_path, "rb") as f:
            files = {"file": (file_path.name, f)}
            resp = self._request("POST", "/api/sync/upload", files=files)

        result = UploadResponse.model_validate(resp.json())
        logger.info(f"Uploaded {file_path.name} → {result.url}")
        return result.url

    def create_page(self, page_state: PageState) -> PageResponse:
        """
        Create a new event page in the CMS.

        Returns:
            PageResponse with id, slug, and title.
        """
        if self.dry_run:
            logger.info(f"[DRY RUN] Would create page: {page_state.title}")
            return PageResponse(
                id="dry-run", slug="dry-run", title=page_state.title
            )

        payload = page_state.model_dump(mode="json")
        resp = self._request("POST", "/api/sync/pages", json=payload)
        result = PageResponse.model_validate(resp.json())
        logger.info(f"Created page: {result.title} (slug: {result.slug})")
        return result
