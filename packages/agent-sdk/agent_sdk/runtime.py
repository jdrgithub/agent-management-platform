from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AgentContext(BaseModel):
    """Execution context passed to agent entrypoints."""

    run_id: str
    agent_id: str
    agent_version: str
    config: dict[str, Any] = Field(default_factory=dict)
    llm: dict[str, Any] | None = None
    """Resolved LLM settings for this run (provider/model/etc)."""


class AgentResult(BaseModel):
    success: bool = True
    output: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
    task_success: bool | None = None
    """Optional: business/task success distinct from technical execution success."""


def normalize_result(raw: Any) -> AgentResult:
    """Normalize entrypoint return values into AgentResult."""
    if isinstance(raw, AgentResult):
        return raw
    if raw is None:
        return AgentResult(success=True, output={})
    if isinstance(raw, dict):
        if "success" in raw or "output" in raw or "error" in raw:
            return AgentResult.model_validate(
                {
                    "success": raw.get("success", raw.get("error") is None),
                    "output": raw.get("output", {k: v for k, v in raw.items() if k not in {"success", "error", "task_success"}}),
                    "error": raw.get("error"),
                    "task_success": raw.get("task_success"),
                }
            )
        return AgentResult(success=True, output=raw)
    return AgentResult(success=True, output={"value": raw})
