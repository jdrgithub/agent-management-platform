from __future__ import annotations

import json
import tarfile
import time
import uuid
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

import docker
from docker.errors import DockerException
from sqlalchemy.orm import Session

from agent_sdk.runtime import normalize_result
from app.config import get_settings
from app.models import AgentRecord, ExecutionRecord
from app.services.executor import ExecutionError
from app.services.llm import resolve_llm_config
from app.services.steps import append_step

RUNNER_SCRIPT = r'''
import json, importlib, subprocess, sys, traceback
from pathlib import Path

payload = json.loads(Path("/tmp/amp_payload.json").read_text())
sys.path.insert(0, "/agent")
module_name, func_name = payload["entrypoint"].split(":", 1)
try:
    req = Path("/agent/requirements.txt")
    if req.is_file():
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "--quiet", "-r", str(req)],
            stdout=subprocess.DEVNULL,
        )
    mod = importlib.import_module(module_name)
    func = getattr(mod, func_name)
    raw = func(payload["inputs"], payload["context"])
    if isinstance(raw, dict) and ("success" in raw or "output" in raw or "error" in raw):
        out = raw
    else:
        out = {"success": True, "output": raw if isinstance(raw, dict) else {"value": raw}}
except Exception as exc:
    out = {"success": False, "error": f"{exc}\n{traceback.format_exc()}", "output": {}}
print(json.dumps(out))
'''


def _client():
    settings = get_settings()
    return docker.DockerClient(base_url=settings.docker_socket)


def _tar_bytes(files: dict[str, bytes]) -> bytes:
    buf = BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as tar:
        for name, content in files.items():
            info = tarfile.TarInfo(name=name)
            info.size = len(content)
            tar.addfile(info, BytesIO(content))
    return buf.getvalue()


def _tar_directory(source: Path, arcname: str = "agent") -> bytes:
    buf = BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as tar:
        for path in source.rglob("*"):
            if path.is_file():
                rel = path.relative_to(source).as_posix()
                tar.add(path, arcname=f"{arcname}/{rel}")
    return buf.getvalue()


def execute_agent_docker(
    db: Session,
    agent: AgentRecord,
    inputs: dict,
) -> ExecutionRecord:
    if not agent.enabled:
        raise ExecutionError(f"Agent is disabled: {agent.id}")

    settings = get_settings()
    manifest = agent.manifest or {}
    runtime = manifest.get("runtime") or {}
    image = runtime.get("image") or settings.default_agent_image
    timeout = int(runtime.get("timeout_seconds") or 600)
    memory_mb = runtime.get("memory_mb") or 512
    nano_cpus = int(float(runtime.get("cpu") or 1.0) * 1e9)

    steps = append_step(
        None,
        "accepted",
        detail=f"agent={agent.id}@{agent.version} mode=docker image={image}",
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
    container = None
    try:
        client = _client()
        try:
            client.images.get(image)
        except Exception:
            client.images.pull(image)
            run.steps = append_step(list(run.steps or []), "image_pulled", detail=image)
            db.commit()

        payload = {
            "entrypoint": agent.entrypoint,
            "inputs": inputs,
            "context": {
                "run_id": str(run.run_id),
                "agent_id": agent.id,
                "agent_version": agent.version,
                "config": agent.config or {},
                "llm": resolve_llm_config(agent.llm_config),
            },
        }

        permissions = manifest.get("permissions") or {}
        environment: dict[str, str] = {
            "OLLAMA_HOST": settings.llm_api_base,
            "HOME": "/root",
        }
        profile = (
            (inputs or {}).get("aws_profile")
            or (agent.config or {}).get("aws_profile")
        )
        if profile:
            environment["AWS_PROFILE"] = str(profile)

        create_kwargs: dict = {
            "image": image,
            "command": ["python", "/tmp/amp_runner.py"],
            "name": f"amp-run-{run.run_id}",
            "detach": True,
            "mem_limit": f"{int(memory_mb)}m",
            "nano_cpus": nano_cpus,
            "working_dir": "/agent",
            "environment": environment,
        }
        if permissions.get("network"):
            create_kwargs["network"] = settings.docker_network
        else:
            create_kwargs["network_mode"] = "none"

        host_aws = (settings.host_aws_dir or "").strip()
        if permissions.get("cloud_read") and host_aws:
            create_kwargs["volumes"] = {
                host_aws: {"bind": "/root/.aws", "mode": "ro"},
            }
            run.steps = append_step(
                list(run.steps or []),
                "aws_credentials_mounted",
                detail=f"host={host_aws} -> /root/.aws:ro",
            )
            db.commit()

        container = client.containers.create(**create_kwargs)
        run.container_id = container.id
        run.steps = append_step(
            list(run.steps or []),
            "started",
            detail=f"entrypoint={agent.entrypoint} container={container.short_id}",
        )
        db.commit()

        package_root = Path(agent.package_path)
        container.put_archive("/", _tar_directory(package_root, "agent"))
        container.put_archive(
            "/tmp",
            _tar_bytes(
                {
                    "amp_runner.py": RUNNER_SCRIPT.encode(),
                    "amp_payload.json": json.dumps(payload).encode(),
                }
            ),
        )
        container.start()
        result = container.wait(timeout=timeout)
        logs = container.logs(stdout=True, stderr=True).decode("utf-8", errors="replace")
        exit_code = result.get("StatusCode", 1)

        parsed = None
        for line in reversed(logs.strip().splitlines()):
            try:
                parsed = json.loads(line)
                break
            except json.JSONDecodeError:
                continue

        if parsed is None:
            run.status = "failed"
            run.error = f"No JSON result from agent (exit={exit_code})\n{logs}"
            run.task_success = False
        else:
            normalized = normalize_result(parsed)
            run.status = "succeeded" if normalized.success and exit_code == 0 else "failed"
            run.outputs = normalized.output
            run.error = normalized.error
            run.task_success = (
                normalized.task_success
                if normalized.task_success is not None
                else normalized.success
            )
            if isinstance(parsed, dict) and isinstance(parsed.get("steps"), list):
                steps_acc = list(run.steps or [])
                for item in parsed["steps"]:
                    if isinstance(item, dict) and item.get("name"):
                        steps_acc = append_step(
                            steps_acc,
                            str(item["name"]),
                            status=str(item.get("status") or "ok"),
                            detail=item.get("detail"),
                        )
                run.steps = steps_acc
    except DockerException as exc:
        run.status = "failed"
        run.error = f"Docker error: {exc}"
        run.task_success = False
    except Exception as exc:  # noqa: BLE001
        run.status = "failed"
        run.error = str(exc)
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
        if container is not None:
            try:
                container.remove(force=True)
            except Exception:  # noqa: BLE001
                pass
        db.commit()
        db.refresh(run)

    return run


def cancel_execution(db: Session, run_id: uuid.UUID) -> ExecutionRecord:
    run = db.get(ExecutionRecord, run_id)
    if run is None:
        raise ExecutionError(f"Execution not found: {run_id}")
    if run.status not in {"queued", "running"}:
        return run

    if run.container_id:
        try:
            client = _client()
            container = client.containers.get(run.container_id)
            container.kill()
            container.remove(force=True)
        except Exception:  # noqa: BLE001
            pass

    run.status = "cancelled"
    run.finished_at = datetime.now(timezone.utc)
    run.task_success = False
    run.error = ((run.error or "") + "\nCancelled by user").strip()
    run.steps = append_step(
        list(run.steps or []),
        "cancelled",
        status="error",
        detail="Cancelled by user",
    )
    db.commit()
    db.refresh(run)
    return run
