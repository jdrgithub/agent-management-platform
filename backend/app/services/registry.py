from __future__ import annotations

import shutil
from pathlib import Path

from agent_sdk.package import load_package, materialize_package
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AgentRecord


class AgentRegistryError(Exception):
    pass


def _dest_for(agent_id: str, version: str) -> Path:
    settings = get_settings()
    return Path(settings.agents_data_dir) / agent_id / version


def install_from_path(db: Session, source_path: str) -> AgentRecord:
    source = Path(source_path)
    if not source.exists():
        raise AgentRegistryError(f"Package path not found: {source_path}")

    staged = load_package(source)
    dest = _dest_for(staged.id, staged.version)
    installed = materialize_package(source, dest)
    manifest = installed.manifest

    existing = db.get(AgentRecord, manifest.id)
    record = existing or AgentRecord(id=manifest.id)
    record.name = manifest.name
    record.description = manifest.description
    record.version = manifest.version
    record.enabled = True if existing is None else existing.enabled
    record.entrypoint = manifest.entrypoint
    record.package_path = str(installed.root)
    record.manifest = manifest.model_dump(by_alias=True)
    if existing is None:
        record.config = {}
        record.llm_config = (
            manifest.llm.model_dump() if manifest.llm is not None else None
        )
        db.add(record)
    elif record.llm_config is None and manifest.llm is not None:
        record.llm_config = manifest.llm.model_dump()

    db.commit()
    db.refresh(record)
    return record


def uninstall(db: Session, agent_id: str) -> None:
    record = db.get(AgentRecord, agent_id)
    if record is None:
        raise AgentRegistryError(f"Agent not found: {agent_id}")

    package_path = Path(record.package_path)
    db.delete(record)
    db.commit()

    if package_path.exists():
        shutil.rmtree(package_path, ignore_errors=True)
        parent = package_path.parent
        if parent.exists() and not any(parent.iterdir()):
            shutil.rmtree(parent, ignore_errors=True)


def set_enabled(db: Session, agent_id: str, enabled: bool) -> AgentRecord:
    record = db.get(AgentRecord, agent_id)
    if record is None:
        raise AgentRegistryError(f"Agent not found: {agent_id}")
    record.enabled = enabled
    db.commit()
    db.refresh(record)
    return record


def update_config(
    db: Session,
    agent_id: str,
    config: dict,
    llm_config: dict | None,
) -> AgentRecord:
    record = db.get(AgentRecord, agent_id)
    if record is None:
        raise AgentRegistryError(f"Agent not found: {agent_id}")
    record.config = config
    if llm_config is not None:
        record.llm_config = llm_config
    db.commit()
    db.refresh(record)
    return record
