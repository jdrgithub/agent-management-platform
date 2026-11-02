from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AgentSummary(BaseModel):
    id: str
    name: str
    description: str
    version: str
    enabled: bool
    created_at: datetime
    updated_at: datetime


class AgentDetail(AgentSummary):
    entrypoint: str
    package_path: str
    manifest: dict[str, Any]
    config: dict[str, Any]
    llm_config: dict[str, Any] | None = None


class AgentConfigUpdate(BaseModel):
    config: dict[str, Any] = Field(default_factory=dict)
    llm_config: dict[str, Any] | None = None


class InstallFromPathRequest(BaseModel):
    path: str
    """Path inside the API container (e.g. /agents/echo-agent)."""


class ExecuteRequest(BaseModel):
    inputs: dict[str, Any] = Field(default_factory=dict)


class ExecutionSummary(BaseModel):
    run_id: uuid.UUID
    agent_id: str
    agent_version: str
    status: str
    task_success: bool | None
    duration_ms: float | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class ExecutionStep(BaseModel):
    ts: str
    name: str
    status: str = "ok"
    detail: str | None = None


class ExecutionDetail(ExecutionSummary):
    inputs: dict[str, Any]
    outputs: dict[str, Any] | None
    error: str | None
    steps: list[ExecutionStep] = Field(default_factory=list)
    container_id: str | None = None
