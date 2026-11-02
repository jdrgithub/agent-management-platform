from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import AuthDep
from app.db import get_db
from app.models import ExecutionRecord
from app.schemas import ExecutionDetail, ExecutionSummary
from app.services.docker_executor import cancel_execution
from app.services.executor import ExecutionError

router = APIRouter(prefix="/executions", tags=["executions"], dependencies=[AuthDep])


@router.get("", response_model=list[ExecutionSummary])
def list_executions(
    agent_id: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> list[ExecutionRecord]:
    limit = max(1, min(limit, 200))
    stmt = select(ExecutionRecord).order_by(ExecutionRecord.created_at.desc()).limit(limit)
    if agent_id:
        stmt = stmt.where(ExecutionRecord.agent_id == agent_id)
    return list(db.scalars(stmt).all())


@router.get("/{run_id}", response_model=ExecutionDetail)
def get_execution(run_id: uuid.UUID, db: Session = Depends(get_db)) -> ExecutionRecord:
    record = db.get(ExecutionRecord, run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Execution not found")
    return record


@router.post("/{run_id}/cancel", response_model=ExecutionDetail)
def cancel_run(run_id: uuid.UUID, db: Session = Depends(get_db)) -> ExecutionRecord:
    try:
        return cancel_execution(db, run_id)
    except ExecutionError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
