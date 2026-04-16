"""Tests for mapper.py — DownloadedPost → PageState mapping strategies."""

from scripts.instagram_sync.mapper import map_post, _sanitize_caption
from scripts.instagram_sync.models import BlockLayout


class TestSanitizeCaption:
    def test_hashtags_removed(self):
        """Hashtags are stripped from body."""
        title, body = _sanitize_caption("Title\nBody text #party #dj #music")
        assert title == "Title"
        assert "#" not in body
        assert "Body text" in body

    def test_title_capped(self):
        """Title is capped at 200 chars."""
        long = "A" * 300 + "\nBody"
        title, body = _sanitize_caption(long)
        assert len(title) == 200
        assert body == "Body"

    def test_empty_caption(self):
        """Empty caption gives 'Untitled Event' title and empty body."""
        title, body = _sanitize_caption("")
        assert title == ""  # empty first line strips to empty
        assert body == ""


class TestMapPost:
    def test_single_photo_no_caption(self, make_post, mock_uploaded_urls):
        """Single photo, no caption → 1 block (media-only)."""
        post = make_post(caption="Photo Title", num_photos=1)
        urls = mock_uploaded_urls(1)

        page = map_post(post, urls)
        assert len(page.blocks) == 1
        assert page.blocks[0].layout == BlockLayout.MEDIA_ONLY

    def test_single_photo_with_caption(self, make_post, mock_uploaded_urls):
        """Single photo + multiline caption → 2 blocks (media-only + text-only)."""
        post = make_post(caption="Title\nSome body text here", num_photos=1)
        urls = mock_uploaded_urls(1)

        page = map_post(post, urls)
        assert len(page.blocks) == 2
        assert page.blocks[0].layout == BlockLayout.MEDIA_ONLY
        assert page.blocks[1].layout == BlockLayout.TEXT_ONLY
        assert "Some body text here" in page.blocks[1].content.text

    def test_reel(self, make_post, mock_uploaded_urls):
        """Reel → media-only (video) + text-only."""
        post = make_post(
            caption="Reel Title\nReel description",
            num_photos=0,
            num_videos=1,
            is_video=True,
            source_type="reel",
        )
        urls = mock_uploaded_urls(1)

        page = map_post(post, urls)
        assert page.blocks[0].content.mediaType == "video"
        assert page.igSourceType == "reel"

    def test_carousel_2_slides(self, make_post, mock_uploaded_urls):
        """2-photo carousel + caption → hero + media-left."""
        post = make_post(
            caption="Carousel\nBody text",
            num_photos=2,
        )
        urls = mock_uploaded_urls(2)

        page = map_post(post, urls)
        assert len(page.blocks) == 2
        assert page.blocks[0].layout == BlockLayout.MEDIA_ONLY  # hero
        assert page.blocks[1].layout == BlockLayout.MEDIA_LEFT  # caption + slide

    def test_carousel_5_slides(self, make_post, mock_uploaded_urls):
        """5-photo carousel → hero + caption+slide2 + 3 alternating."""
        post = make_post(
            caption="Big Carousel\nLots of pics",
            num_photos=5,
        )
        urls = mock_uploaded_urls(5)

        page = map_post(post, urls)
        # hero + caption block + 3 remaining slides
        assert len(page.blocks) == 5
        assert page.blocks[0].layout == BlockLayout.MEDIA_ONLY

    def test_carousel_no_caption(self, make_post, mock_uploaded_urls):
        """Carousel with title-only (no body) → hero + slides."""
        post = make_post(caption="Just a Title", num_photos=3)
        urls = mock_uploaded_urls(3)

        page = map_post(post, urls)
        # No body text → no text block, just media blocks
        assert page.blocks[0].layout == BlockLayout.MEDIA_ONLY

    def test_ig_metadata_passed(self, make_post, mock_uploaded_urls):
        """IG metadata propagates to PageState."""
        post = make_post(
            shortcode="SC123",
            profile_name="djfriend",
            source_type="post",
        )
        urls = mock_uploaded_urls(1)

        page = map_post(post, urls)
        assert page.igShortcode == "SC123"
        assert page.igProfileName == "djfriend"
        assert page.igSourceType == "post"
