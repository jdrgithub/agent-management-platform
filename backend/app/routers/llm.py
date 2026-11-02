from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.auth import AuthDep
from app.config import get_settings
from app.services.llm import chat_completion, resolve_llm_config

router = APIRouter(prefix="/llm", tags=["llm"], dependencies=[AuthDep])


class ChatRequest(BaseModel):
    messages: list[dict[str, str]] = Field(default_factory=list)
    llm_config: dict[str, Any] | None = None


@router.get("/status")
def llm_status() -> dict:
    settings = get_settings()
    cfg = resolve_llm_config(None) or {}
    reachable = False
    detail: str | None = None
    try:
        base = settings.llm_api_base.rstrip("/")
        # Ollama tags endpoint; other providers may not respond here.
        with httpx.Client(timeout=3.0) as client:
            resp = client.get(f"{base}/api/tags")
            reachable = resp.status_code < 500
            detail = f"status={resp.status_code}"
    except Exception as exc:  # noqa: BLE001
        detail = str(exc)
    return {
        "provider": cfg.get("provider"),
        "model": cfg.get("model"),
        "api_base": settings.llm_api_base,
        "reachable": reachable,
        "detail": detail,
    }


@router.post("/chat")
def llm_chat(body: ChatRequest) -> dict:
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages required")
    try:
        return chat_completion(body.messages, body.llm_config)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc
