"""Tests for entrypoint.py — the orchestrator of the ETL pipeline."""

from unittest.mock import patch, MagicMock
from scripts.instagram_sync.entrypoint import run_extractor, run_transformer
from scripts.instagram_sync.downloader import InstagramRateLimitError
from scripts.instagram_sync.uploader import CMSApiError


@patch("scripts.instagram_sync.entrypoint.IGDownloader")
@patch("scripts.instagram_sync.entrypoint.MindraCMSAPI")
@patch("scripts.instagram_sync.entrypoint.CheckpointManager")
def test_run_extractor_success(mock_ckpt, mock_api_class, mock_dl_class, tmp_config, make_post):
    """Test standard extractor flow."""
    dl = mock_dl_class.return_value
    api = mock_api_class.return_value
    ckpt = mock_ckpt.return_value
    ckpt.get_known_shortcodes.return_value = set()
    ckpt.is_processed.return_value = False

    post = make_post(shortcode="EXTRACT", num_photos=1)
    dl.fetch_profile_posts.return_value = [post]
    api.upload_media.return_value = "/uploads/test.jpg"
    
    # CMS existing check returns False
    api.check_shortcode_exists.return_value = False

    run_extractor("test_profile", tmp_config)

    dl.fetch_profile_posts.assert_called_once()
    api.upload_media.assert_called_once()
    api.push_raw_post.assert_called_once()
    assert "EXTRACT" in api.push_raw_post.call_args[0][0]["shortcode"]
    ckpt.mark_processed.assert_called_with("EXTRACT")


@patch("scripts.instagram_sync.entrypoint.IGDownloader")
@patch("scripts.instagram_sync.entrypoint.MindraCMSAPI")
@patch("scripts.instagram_sync.entrypoint.CheckpointManager")
def test_run_extractor_rate_limit(mock_ckpt, mock_api_class, mock_dl_class, tmp_config, make_post):
    """If IGDownloader throws RateLimit, it catches gracefully without data loss."""
    dl = mock_dl_class.return_value
    api = mock_api_class.return_value
    ckpt = mock_ckpt.return_value

    dl.fetch_profile_posts.side_effect = InstagramRateLimitError("Blocked")

    run_extractor("test_profile", tmp_config)
    
    api.push_raw_post.assert_not_called()
    ckpt.finalize.assert_called()


@patch("scripts.instagram_sync.entrypoint.MindraCMSAPI")
@patch("scripts.instagram_sync.entrypoint.map_job")
def test_run_transformer_success(mock_map_job, mock_api_class, tmp_config, make_raw_job):
    """Transformer reads a job, maps it, creates CMS page, and marks COMPLETED."""
    api = mock_api_class.return_value
    job = make_raw_job(shortcode="DBJOB")
    
    # We yield a job once, then None to simulate empty queue
    api.fetch_job_from_queue.side_effect = [job, None]
    
    mock_page_state = MagicMock()
    mock_map_job.return_value = mock_page_state
    
    mock_result = MagicMock()
    mock_result.title = "Mapped Page"
    mock_result.slug = "mapped-page"
    api.create_page.return_value = mock_result

    run_transformer(tmp_config)

    mock_map_job.assert_called_once_with(job)
    api.create_page.assert_called_once_with(mock_page_state)
    api.update_job_status.assert_called_once_with("cuid1234", "COMPLETED")


@patch("scripts.instagram_sync.entrypoint.MindraCMSAPI")
@patch("scripts.instagram_sync.entrypoint.map_job")
def test_run_transformer_llm_failure(mock_map_job, mock_api_class, tmp_config, make_raw_job):
    """If mapping (LLM) fails, the job must be set to ERROR status."""
    api = mock_api_class.return_value
    job = make_raw_job(shortcode="LLMFAIL")
    api.fetch_job_from_queue.side_effect = [job, None]
    
    # Simulate OpenRouter error inside mapping
    mock_map_job.side_effect = Exception("OpenRouter 502 Bad Gateway")

    run_transformer(tmp_config)

    api.create_page.assert_not_called()
    api.update_job_status.assert_called_once_with("cuid1234", "ERROR", "OpenRouter 502 Bad Gateway")
