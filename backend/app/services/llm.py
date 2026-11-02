from __future__ import annotations

from typing import Any

from app.config import get_settings


def resolve_llm_config(agent_llm: dict[str, Any] | None) -> dict[str, Any] | None:
    """Merge agent LLM settings with platform defaults. Does not call providers."""
    settings = get_settings()
    if not agent_llm and not settings.default_llm_model:
        return None

    cfg = {
        "provider": settings.default_llm_provider,
        "model": settings.default_llm_model or "llama3",
        "api_base": settings.llm_api_base,
    }
    if agent_llm:
        cfg.update({k: v for k, v in agent_llm.items() if v is not None})
    return cfg


def litellm_model_name(cfg: dict[str, Any]) -> str:
    """Map provider/model to a LiteLLM model string."""
    provider = (cfg.get("provider") or "ollama").lower()
    model = cfg.get("model") or "llama3"
    if "/" in model:
        return model
    if provider in {"ollama", "local"}:
        return f"ollama/{model}"
    if provider in {"openai", "anthropic", "azure"}:
        return f"{provider}/{model}"
    return model


def chat_completion(
    messages: list[dict[str, str]],
    llm_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Call LiteLLM with the resolved config. Optional until agents need it."""
    import litellm

    cfg = resolve_llm_config(llm_config) or {}
    model = litellm_model_name(cfg)
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
    }
    api_base = cfg.get("api_base")
    if api_base:
        kwargs["api_base"] = api_base
    if cfg.get("temperature") is not None:
        kwargs["temperature"] = cfg["temperature"]
    if cfg.get("max_tokens") is not None:
        kwargs["max_tokens"] = cfg["max_tokens"]

    response = litellm.completion(**kwargs)
    content = response.choices[0].message["content"]
    return {
        "model": model,
        "content": content,
        "usage": getattr(response, "usage", None),
    }
