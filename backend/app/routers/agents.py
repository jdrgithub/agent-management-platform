from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import AuthDep
from app.db import get_db
from app.models import AgentRecord
from app.schemas import (
    AgentConfigUpdate,
    AgentDetail,
    AgentSummary,
    ExecuteRequest,
    ExecutionDetail,
    InstallFromPathRequest,
)
from app.services.executor import ExecutionError, execute_agent
from app.services.registry import (
    AgentRegistryError,
    install_from_path,
    set_enabled,
    uninstall,
    update_config,
)

router = APIRouter(prefix="/agents", tags=["agents"], dependencies=[AuthDep])


def _detail(record: AgentRecord) -> AgentDetail:
    return AgentDetail.model_validate(record, from_attributes=True)


@router.get("", response_model=list[AgentSummary])
def list_agents(db: Session = Depends(get_db)) -> list[AgentRecord]:
    return list(db.scalars(select(AgentRecord).order_by(AgentRecord.id)).all())


@router.get("/{agent_id}", response_model=AgentDetail)
def get_agent(agent_id: str, db: Session = Depends(get_db)) -> AgentRecord:
    record = db.get(AgentRecord, agent_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return record


@router.post("/install/path", response_model=AgentDetail, status_code=201)
def install_agent_from_path(
    body: InstallFromPathRequest,
    db: Session = Depends(get_db),
) -> AgentRecord:
    try:
        return install_from_path(db, body.path)
    except AgentRegistryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/install/upload", response_model=AgentDetail, status_code=201)
async def install_agent_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> AgentRecord:
    suffix = Path(file.filename or "agent.zip").suffix or ".zip"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = Path(tmp.name)
        shutil.copyfileobj(file.file, tmp)
    try:
        return install_from_path(db, str(tmp_path))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        tmp_path.unlink(missing_ok=True)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: str, db: Session = Depends(get_db)) -> Response:
    try:
        uninstall(db, agent_id)
    except AgentRegistryError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{agent_id}/enable", response_model=AgentDetail)
def enable_agent(agent_id: str, db: Session = Depends(get_db)) -> AgentRecord:
    try:
        return set_enabled(db, agent_id, True)
    except AgentRegistryError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{agent_id}/disable", response_model=AgentDetail)
def disable_agent(agent_id: str, db: Session = Depends(get_db)) -> AgentRecord:
    try:
        return set_enabled(db, agent_id, False)
    except AgentRegistryError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/{agent_id}/config", response_model=AgentDetail)
def configure_agent(
    agent_id: str,
    body: AgentConfigUpdate,
    db: Session = Depends(get_db),
) -> AgentRecord:
    try:
        return update_config(db, agent_id, body.config, body.llm_config)
    except AgentRegistryError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{agent_id}/execute", response_model=ExecutionDetail)
def run_agent(
    agent_id: str,
    body: ExecuteRequest,
    db: Session = Depends(get_db),
) -> object:
    agent = db.get(AgentRecord, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    try:
        return execute_agent(db, agent, body.inputs)
    except ExecutionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
