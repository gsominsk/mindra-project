import unittest
from unittest.mock import patch, Mock
import requests
import json
import os
from scripts.instagram_sync.llm import create_llm_client, OpenRouterClient, NvidiaClient, LLMResponseError
from scripts.instagram_sync.config import SyncConfig

class TestLLMClients(unittest.TestCase):
    def setUp(self):
        self.system_prompt = "Test System"
        self.user_prompt = "Test User"
        self.config = SyncConfig()
        self.config.openrouter_api_key = "sk-or-v1-test_key_123"
        self.config.nvidia_api_key = "nvapi-test_key_456"

    def test_factory_creates_openrouter(self):
        self.config.llm_provider = "openrouter"
        client = create_llm_client(self.config)
        self.assertIsInstance(client, OpenRouterClient)
        self.assertEqual(client.api_key, "sk-or-v1-test_key_123")

    def test_factory_creates_nvidia(self):
        self.config.llm_provider = "nvidia"
        client = create_llm_client(self.config)
        self.assertIsInstance(client, NvidiaClient)
        self.assertEqual(client.api_key, "nvapi-test_key_456")

    @patch.dict(os.environ, {}, clear=True)
    def test_missing_api_key_exception(self):
        no_key_client = OpenRouterClient(api_key="")
        with self.assertRaises(LLMResponseError) as context:
            no_key_client.get_analysis("sys", "user")
        self.assertTrue("Missing OPENROUTER_API_KEY" in str(context.exception))

        no_key_nvidia = NvidiaClient(api_key="")
        with self.assertRaises(LLMResponseError) as context:
            no_key_nvidia.get_analysis("sys", "user")
        self.assertTrue("Missing NVIDIA_API_KEY" in str(context.exception))

    @patch("scripts.instagram_sync.llm.requests.post")
    def test_get_analysis_success_nvidia(self, mock_post):
        client = NvidiaClient(api_key="nvapi-test_key_456")
        
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "choices": [{
                "message": {
                    "content": json.dumps({"chunks": ["A", "B"]})
                }
            }]
        }
        mock_post.return_value = mock_response

        result = client.get_analysis(self.system_prompt, self.user_prompt)
        self.assertEqual(result, {"chunks": ["A", "B"]})
        
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "https://integrate.api.nvidia.com/v1/chat/completions")
        self.assertIn("headers", kwargs)
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer nvapi-test_key_456")
        self.assertEqual(kwargs["json"]["model"], "meta/llama-3.1-70b-instruct")

    @patch("scripts.instagram_sync.llm.requests.post")
    def test_network_failure_exhausts_retries(self, mock_post):
        client = OpenRouterClient(api_key="sk-or-v1-test_key_123")
        mock_post.side_effect = requests.exceptions.ConnectionError("Offline")
        
        with self.assertRaises(LLMResponseError) as context:
            client.get_analysis(self.system_prompt, self.user_prompt, max_retries=2)
            
        self.assertTrue("Network error after retries" in str(context.exception))
        self.assertEqual(mock_post.call_count, 2)

if __name__ == "__main__":
    unittest.main()
