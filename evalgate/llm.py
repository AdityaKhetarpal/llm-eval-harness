"""
LLM: one small function to talk to a model
------------------------------------------
Used by the `openai` target (the app under test is a plain model + prompt) and by the AI judge.

    provider: openai      any OpenAI-compatible API (OpenAI, Groq, Together, OpenRouter, a local vLLM / Ollama server)
              anthropic   the Anthropic Messages API
              local       a Hugging Face model running on this machine (needs `pip install evalgate[local]`)
              fake        canned replies, for tests

API keys are NEVER written in the suite: the suite names an environment variable (api_key_env) and the
key is read from there (on GitHub, from a repository secret).
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from functools import lru_cache

DEFAULTS = {
    "openai": {"base_url": "https://api.openai.com/v1", "api_key_env": "OPENAI_API_KEY", "model": "gpt-4o-mini"},
    "anthropic": {"base_url": "https://api.anthropic.com/v1", "api_key_env": "ANTHROPIC_API_KEY",
                  "model": "claude-haiku-5-5"},
    "local": {"model": "Qwen/Qwen2.5-1.5B-Instruct"},
}


class LLMError(RuntimeError):
    pass


def _post(url: str, body: dict, headers: dict, retries: int = 4, timeout: int = 120) -> dict:
    data = json.dumps(body).encode()
    for attempt in range(retries + 1):
        request = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json", **headers})
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as e:
            # rate limited or the server is busy: wait and try again
            if e.code in (429, 500, 502, 503, 529) and attempt < retries:
                wait = float(e.headers.get("retry-after") or 2 ** (attempt + 1))
                time.sleep(min(wait, 30))
                continue
            raise LLMError(f"HTTP {e.code} from {url}: {e.read()[:300]!r}") from e
        except urllib.error.URLError as e:
            if attempt < retries:
                time.sleep(2 ** (attempt + 1))
                continue
            raise LLMError(f"could not reach {url}: {e.reason}") from e
    raise LLMError("unreachable")


def _key(config: dict, provider: str) -> str:
    env = config.get("api_key_env") or DEFAULTS[provider]["api_key_env"]
    key = os.environ.get(env, "")
    if not key:
        raise LLMError(f"set the {env} environment variable (the API key is never stored in the suite)")
    return key


def _openai(messages: list[dict], config: dict) -> str:
    base = (config.get("base_url") or DEFAULTS["openai"]["base_url"]).rstrip("/")
    body = {
        "model": config.get("model") or DEFAULTS["openai"]["model"],
        "messages": messages,
        "temperature": config.get("temperature", 0),
        "max_tokens": config.get("max_tokens", 512),
    }
    reply = _post(f"{base}/chat/completions", body, {"Authorization": f"Bearer {_key(config, 'openai')}"})
    return reply["choices"][0]["message"]["content"] or ""


def _anthropic(messages: list[dict], config: dict) -> str:
    base = (config.get("base_url") or DEFAULTS["anthropic"]["base_url"]).rstrip("/")
    system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
    rest = [m for m in messages if m["role"] != "system"]
    body = {
        "model": config.get("model") or DEFAULTS["anthropic"]["model"],
        "max_tokens": config.get("max_tokens", 512),
        "temperature": config.get("temperature", 0),
        "messages": rest,
    }
    if system:
        body["system"] = system
    headers = {"x-api-key": _key(config, "anthropic"), "anthropic-version": "2023-06-01"}
    reply = _post(f"{base}/messages", body, headers)
    return "".join(block.get("text", "") for block in reply.get("content", []))


@lru_cache(maxsize=2)
def _local_model(name: str):
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError as e:  # pragma: no cover - depends on optional extras
        raise LLMError("the local provider needs: pip install 'evalgate[local]'") from e
    tokenizer = AutoTokenizer.from_pretrained(name)
    model = AutoModelForCausalLM.from_pretrained(name, torch_dtype=torch.float32)
    model.eval()
    return tokenizer, model


def _local(messages: list[dict], config: dict) -> str:  # pragma: no cover - needs a real model
    import torch

    tokenizer, model = _local_model(config.get("model") or DEFAULTS["local"]["model"])
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt")
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=config.get("max_tokens", 64), do_sample=False)
    return tokenizer.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)


def _fake(messages: list[dict], config: dict) -> str:
    """Canned replies for tests: `replies` maps a regex (searched in the last message) to a reply."""
    last = messages[-1]["content"]
    for pattern, reply in (config.get("replies") or {}).items():
        if re.search(pattern, last, flags=re.S):
            return reply
    return config.get("default", "")


PROVIDERS = {"openai": _openai, "anthropic": _anthropic, "local": _local, "fake": _fake}


def chat(messages: list[dict], config: dict) -> str:
    """Send chat messages to the configured model and return its reply text."""
    provider = config.get("provider", "openai")
    if provider not in PROVIDERS:
        raise LLMError(f"unknown provider {provider!r}; use one of {', '.join(PROVIDERS)}")
    return PROVIDERS[provider](messages, config)


def describe(config: dict) -> str:
    """A short label like 'openai:llama-3.3-70b-versatile' for reports (never includes keys)."""
    provider = config.get("provider", "openai")
    model = config.get("model") or DEFAULTS.get(provider, {}).get("model", "")
    return f"{provider}:{model}" if model else provider
