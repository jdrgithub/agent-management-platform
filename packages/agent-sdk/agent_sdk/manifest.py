from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field, field_validator


class LLMConfig(BaseModel):
    """Default LLM preferences for an agent. Overridable at install/runtime."""

    provider: str = "ollama"
    model: str = "llama3"
    temperature: float | None = None
    max_tokens: int | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class RuntimeRequirements(BaseModel):
    """How the platform should run the agent."""

    kind: str = "docker"
    image: str | None = None
    python: str | None = "3.12"
    timeout_seconds: int = 600
    memory_mb: int | None = 512
    cpu: float | None = 1.0
    env: list[str] = Field(default_factory=list)
    """Names of env vars the agent may receive (values supplied by platform config)."""


class AgentPermissions(BaseModel):
    network: bool = False
    filesystem_write: bool = False
    cloud_read: bool = False
    cloud_write: bool = False
    docker_socket: bool = False
    extra: list[str] = Field(default_factory=list)


class AgentManifest(BaseModel):
    """Contract every installable agent must declare in agent.yaml."""

    api_version: str = Field(default="amp/v1", alias="apiVersion")
    id: str
    name: str
    description: str = ""
    version: str
    entrypoint: str
    """Module path form: `package.module:function`."""

    input_schema: dict[str, Any] = Field(default_factory=dict, alias="inputSchema")
    output_schema: dict[str, Any] = Field(default_factory=dict, alias="outputSchema")
    dependencies: list[str] = Field(default_factory=list)
    permissions: AgentPermissions = Field(default_factory=AgentPermissions)
    llm: LLMConfig | None = None
    runtime: RuntimeRequirements = Field(default_factory=RuntimeRequirements)
    tags: list[str] = Field(default_factory=list)
    homepage: str | None = None

    model_config = {"populate_by_name": True}

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        allowed = set("abcdefghijklmnopqrstuvwxyz0123456789-_")
        if not value or any(ch not in allowed for ch in value):
            raise ValueError(
                "id must be lowercase alphanumeric with hyphens/underscores only"
            )
        return value

    @field_validator("entrypoint")
    @classmethod
    def validate_entrypoint(cls, value: str) -> str:
        if ":" not in value:
            raise ValueError("entrypoint must be 'module.path:function'")
        module, func = value.split(":", 1)
        if not module or not func:
            raise ValueError("entrypoint must be 'module.path:function'")
        return value


def load_manifest(path: Path | str) -> AgentManifest:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("agent.yaml must be a mapping")
    return AgentManifest.model_validate(data)
