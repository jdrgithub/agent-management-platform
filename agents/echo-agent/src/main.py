from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def run(inputs: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Echo agent entrypoint — framework-independent."""
    if inputs.get("fail"):
        return {
            "success": False,
            "error": "Deliberate failure requested via inputs.fail=true",
            "output": {"echo": inputs.get("message", "")},
            "task_success": False,
        }

    return {
        "success": True,
        "output": {
            "echo": inputs.get("message", ""),
            "received_at": datetime.now(timezone.utc).isoformat(),
            "run_id": (context or {}).get("run_id"),
        },
        "task_success": True,
    }
