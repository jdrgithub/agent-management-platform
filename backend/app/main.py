from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import Base, check_database, engine
from app.routers import agents, executions, llm

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Lightweight additive migration for early versions
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if inspector.has_table("executions"):
        cols = {c["name"] for c in inspector.get_columns("executions")}
        with engine.begin() as conn:
            if "container_id" not in cols:
                conn.execute(
                    text("ALTER TABLE executions ADD COLUMN container_id VARCHAR(128)")
                )
            if "steps" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE executions ADD COLUMN steps JSONB NOT NULL DEFAULT '[]'::jsonb"
                    )
                )
    yield


app = FastAPI(
    title="Agent Management Platform API",
    version="0.4.0",
    description="Standalone management API for installable AI agents.",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router, prefix="/api/v1")
app.include_router(executions.router, prefix="/api/v1")
app.include_router(llm.router, prefix="/api/v1")


@app.get("/health")
def health() -> dict:
    db_ok = False
    db_error: str | None = None
    try:
        db_ok = check_database()
    except Exception as exc:  # noqa: BLE001
        db_error = str(exc)

    status = "ok" if db_ok else "degraded"
    payload: dict = {
        "status": status,
        "service": "agent-management-api",
        "version": "0.4.0",
        "database": "ok" if db_ok else "error",
        "execution_mode": settings.execution_mode,
    }
    if db_error:
        payload["database_error"] = db_error
    return payload


@app.get("/")
def root() -> dict:
    return {
        "service": "agent-management-api",
        "docs": "/docs",
        "health": "/health",
        "api": "/api/v1",
    }
