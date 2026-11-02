from __future__ import annotations

import importlib
import sys
import time
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path

from agent_sdk.runtime import AgentContext, normalize_result
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AgentRecord, ExecutionRecord
from app.services.llm import resolve_llm_config
from app.services.steps import append_step


class ExecutionError(Exception):
    pass


def _load_entrypoint(package_path: str, entrypoint: str):
    module_name, func_name = entrypoint.split(":", 1)
    root = str(Path(package_path).resolve())
    if root not in sys.path:
        sys.path.insert(0, root)
    module = importlib.import_module(module_name)
    func = getattr(module, func_name, None)
    if func is None or not callable(func):
        raise ExecutionError(f"Entrypoint not callable: {entrypoint}")
    return func


def execute_agent_local(
    db: Session,
    agent: AgentRecord,
    inputs: dict,
) -> ExecutionRecord:
    if not agent.enabled:
        raise ExecutionError(f"Agent is disabled: {agent.id}")

    steps = append_step(
        None,
        "accepted",
        detail=f"agent={agent.id}@{agent.version} mode=local",
    )
    run = ExecutionRecord(
        run_id=uuid.uuid4(),
        agent_id=agent.id,
        agent_version=agent.version,
        status="running",
        inputs=inputs,
        steps=steps,
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    started = time.perf_counter()
    try:
        steps = append_step(
            list(run.steps or []),
            "started",
            detail=f"entrypoint={agent.entrypoint}",
        )
        run.steps = steps
        db.commit()

        func = _load_entrypoint(agent.package_path, agent.entrypoint)
        context = AgentContext(
            run_id=str(run.run_id),
            agent_id=agent.id,
            agent_version=agent.version,
            config=agent.config or {},
            llm=resolve_llm_config(agent.llm_config),
        )
        raw = func(inputs, context.model_dump())
        result = normalize_result(raw)
        run.status = "succeeded" if result.success else "failed"
        run.outputs = result.output
        run.error = result.error
        run.task_success = (
            result.task_success if result.task_success is not None else result.success
        )
        # Merge optional agent-emitted steps
        if isinstance(raw, dict) and isinstance(raw.get("steps"), list):
            steps = list(run.steps or [])
            for item in raw["steps"]:
                if isinstance(item, dict) and item.get("name"):
                    steps = append_step(
                        steps,
                        str(item["name"]),
                        status=str(item.get("status") or "ok"),
                        detail=item.get("detail"),
                    )
            run.steps = steps
    except Exception as exc:  # noqa: BLE001
        run.status = "failed"
        run.error = f"{exc}\n{traceback.format_exc()}"
        run.task_success = False
    finally:
        run.finished_at = datetime.now(timezone.utc)
        run.duration_ms = (time.perf_counter() - started) * 1000
        final_name = "finished" if run.status == "succeeded" else "failed"
        run.steps = append_step(
            list(run.steps or []),
            final_name,
            status="ok" if run.status == "succeeded" else "error",
            detail=f"duration_ms={run.duration_ms:.1f}",
        )
        db.commit()
        db.refresh(run)

    return run


def execute_agent(
    db: Session,
    agent: AgentRecord,
    inputs: dict,
) -> ExecutionRecord:
    settings = get_settings()
    if settings.execution_mode.lower() == "docker":
        from app.services.docker_executor import execute_agent_docker

        return execute_agent_docker(db, agent, inputs)
    return execute_agent_local(db, agent, inputs)
