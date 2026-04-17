import os
import json
import time
import requests
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Union
from .config import SyncConfig

logger = logging.getLogger("ig_sync.llm")

class LLMResponseError(Exception):
    pass

class BaseLLMClient(ABC):
    """Abstract base class for LLM clients."""
    
    @abstractmethod
    def get_api_url(self) -> str:
        pass

    @abstractmethod
    def get_headers(self) -> Dict[str, str]:
        pass

    @abstractmethod
    def get_payload(self, system_prompt: str, user_prompt: str, response_format: str) -> Dict[str, Any]:
        pass
        
    def get_analysis(
        self, 
        system_prompt: str, 
        user_prompt: str, 
        response_format: str = "json_object",
        max_retries: int = 3,
        trace_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends a composed prompt to the provider and returns the structured JSON response.
        Handles retry logic and JSON validation locally.
        """
        api_url = self.get_api_url()
        headers = self.get_headers()
        payload = self.get_payload(system_prompt, user_prompt, response_format)

        for attempt in range(max_retries):
            masked_headers = headers.copy()
            if "Authorization" in masked_headers:
                masked_headers["Authorization"] = f"Bearer ***{headers['Authorization'][-4:]}"
                
            logger.info(
                f"[Trace: {trace_id}] Request attempt {attempt + 1}/{max_retries} | "
                f"Provider: {self.__class__.__name__} | Headers: {masked_headers}"
            )
            logger.debug(f"[Trace: {trace_id}] LLM Payload: {json.dumps(payload, ensure_ascii=False)}")

            response = None
            try:
                response = requests.post(api_url, headers=headers, json=payload, timeout=120)
                logger.debug(f"[Trace: {trace_id}] Received HTTP Status: {response.status_code}")
                response.raise_for_status()

                data = response.json()
                content_str = data["choices"][0]["message"]["content"]
                logger.debug(f"[Trace: {trace_id}] LLM Raw Response: {content_str}")
                
                if response_format == "json_object":
                    parsed_content = json.loads(content_str.strip())
                    return parsed_content
                
                return {"text": content_str.strip()}

            except requests.exceptions.RequestException as e:
                logger.warning(f"[Trace: {trace_id}] Network error on attempt {attempt + 1}: {e}")
                if response is not None and response.status_code == 429:
                    logger.warning(f"[Trace: {trace_id}] Rate limit hit (429). Backing off...")
                    time.sleep(2 ** attempt)
                    continue
                if attempt + 1 >= max_retries:
                    raise LLMResponseError(f"Network error after retries: {e}") from e

            except (json.JSONDecodeError, KeyError) as e:
                logger.error(f"[Trace: {trace_id}] Parse error on attempt {attempt + 1}: {e}")
                if attempt + 1 >= max_retries:
                    raise LLMResponseError("Valid JSON response could not be extracted.") from e
                
        raise LLMResponseError("LLM client failed after all retries.")

class OpenRouterClient(BaseLLMClient):
    """
    Domain-agnostic LLM client for interacting with the OpenRouter API.
    """
    def __init__(self, api_key: Optional[str] = None, model: Union[str, list, None] = None):
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.model = model or [
            "nvidia/nemotron-3-super-120b-a12b:free",
            "google/gemma-4-31b-it:free",
            "z-ai/glm-4.5-air:free"
        ]
        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY is not set. API calls will fail.")

    def get_api_url(self) -> str:
        return "https://openrouter.ai/api/v1/chat/completions"

    def get_headers(self) -> Dict[str, str]:
        if not self.api_key:
            raise LLMResponseError("Missing OPENROUTER_API_KEY")
        return {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "http://localhost:3000",
            "Content-Type": "application/json"
        }

    def get_payload(self, system_prompt: str, user_prompt: str, response_format: str) -> Dict[str, Any]:
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
        }
        if isinstance(self.model, list):
            payload["models"] = self.model
        else:
            payload["model"] = self.model
            
        if response_format == "json_object":
             payload["response_format"] = {"type": "json_object"}
             
        return payload

class NvidiaClient(BaseLLMClient):
    """
    Domain-agnostic LLM client for interacting with the NVIDIA NIM API.
    """
    def __init__(self, api_key: Optional[str] = None, model: str = "meta/llama-3.1-70b-instruct"):
        self.api_key = api_key or os.getenv("NVIDIA_API_KEY")
        self.model = model
        if not self.api_key:
            logger.warning("NVIDIA_API_KEY is not set. API calls will fail.")
            
    def get_api_url(self) -> str:
        return "https://integrate.api.nvidia.com/v1/chat/completions"

    def get_headers(self) -> Dict[str, str]:
        if not self.api_key:
            raise LLMResponseError("Missing NVIDIA_API_KEY")
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def get_payload(self, system_prompt: str, user_prompt: str, response_format: str) -> Dict[str, Any]:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        }
        if response_format == "json_object":
             payload["response_format"] = {"type": "json_object"}
             
        return payload

def create_llm_client(config: SyncConfig) -> BaseLLMClient:
    """Factory to instantiate the appropriate LLM Client based on config."""
    if config.llm_provider == "nvidia":
        return NvidiaClient(api_key=config.nvidia_api_key)
    return OpenRouterClient(api_key=config.openrouter_api_key)
