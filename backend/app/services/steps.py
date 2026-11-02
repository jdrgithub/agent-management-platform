from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def new_step(name: str, status: str = "ok", detail: str | None = None) -> dict[str, Any]:
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "name": name,
        "status": status,
        "detail": detail,
    }


def append_step(
    steps: list[dict[str, Any]] | None,
    name: str,
    status: str = "ok",
    detail: str | None = None,
) -> list[dict[str, Any]]:
    out = list(steps or [])
    out.append(new_step(name, status=status, detail=detail))
    return out
