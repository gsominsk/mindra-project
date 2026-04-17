"""Tests for mapper.py — Raw DB Job → PageState mapping strategies."""

from scripts.instagram_sync.mapper import map_job, _sanitize_caption
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
        assert title == "Untitled Event"
        assert body == ""


class TestMapJob:
    def test_single_photo_no_caption(self, make_raw_job):
        """Single photo, no caption → 1 block (media-only)."""
        job = make_raw_job(caption="Photo Title", num_photos=1)
        page = map_job(job)
        assert len(page.blocks) == 1
        assert page.blocks[0].layout == BlockLayout.MEDIA_ONLY

    def test_single_photo_with_caption(self, make_raw_job):
        """Single photo + multiline caption → 2 blocks (media-only + text-only)."""
        job = make_raw_job(caption="Title\nSome body text here", num_photos=1)
        page = map_job(job)
        assert len(page.blocks) == 2
        assert page.blocks[0].layout == BlockLayout.MEDIA_ONLY
        assert page.blocks[1].layout == BlockLayout.TEXT_ONLY
        assert "Some body text here" in page.blocks[1].content.text

    def test_reel(self, make_raw_job):
        """Reel → media-only (video) + text-only."""
        job = make_raw_job(
            caption="Reel Title\nReel description",
            num_photos=0,
            num_videos=1,
            source_type="reel",
        )
        page = map_job(job)
        assert page.blocks[0].content.mediaType == "video"
        assert page.igSourceType == "reel"

    def test_carousel_2_slides(self, caplog, monkeypatch, make_raw_job):
        import scripts.instagram_sync.mapper as mapper
        monkeypatch.setattr(mapper.llm_client, "get_analysis", lambda *a, **k: {"chunks": ["chunk1"]})
        job = make_raw_job(
            caption="Carousel\nBody text",
            num_photos=2,
        )
        page = map_job(job)
        assert len(page.blocks) == 2
        assert page.blocks[0].layout == BlockLayout.MEDIA_ONLY  # hero
        assert page.blocks[1].layout == BlockLayout.MEDIA_LEFT  # caption + slide

    def test_carousel_5_slides(self, monkeypatch, make_raw_job):
        """5-photo carousel → hero + caption+slide2 + 3 alternating."""
        import scripts.instagram_sync.mapper as mapper
        monkeypatch.setattr(mapper.llm_client, "get_analysis", lambda *a, **k: {"chunks": ["c1", "c2", "c3"]})
        job = make_raw_job(
            caption="Big Carousel\nLots of pics",
            num_photos=5,
        )
        page = map_job(job)
        # hero + caption block + 3 remaining slides
        assert len(page.blocks) == 5
        assert page.blocks[0].layout == BlockLayout.MEDIA_ONLY

    def test_carousel_no_caption(self, make_raw_job):
        """Carousel with title-only (no body) → hero + slides."""
        job = make_raw_job(caption="Just a Title", num_photos=3)
        page = map_job(job)
        # No body text → no text block, just media blocks
        assert page.blocks[0].layout == BlockLayout.MEDIA_ONLY

    def test_ig_metadata_passed(self, make_raw_job):
        """IG metadata propagates to PageState."""
        job = make_raw_job(
            shortcode="SC123",
            profile_name="djfriend",
            source_type="post",
        )
        page = map_job(job)
        assert page.igShortcode == "SC123"
        assert page.igProfileName == "djfriend"
        assert page.igSourceType == "post"
