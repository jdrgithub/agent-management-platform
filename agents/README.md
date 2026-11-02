# Writing agents for this platform

Agents are **separate packages**. They do not need to live in this repository. This repo is the management platform (API + Grafana plugin); your agent code can live anywhere.

## What “the contract” is (and is not)

Installable agents must follow the **Agent Management Platform agent package contract**, identified in manifests as:

```yaml
apiVersion: amp/v1
```

That `amp/v1` label is **specific to this project**. It is **not** an industry-wide standard (unlike OpenAPI, MCP, etc.).

Authors will still recognize familiar building blocks:

- **JSON Schema** for `inputSchema` / `outputSchema`
- A plain **Python function** as the entrypoint
- Optional **Docker** image / resource limits for isolated runs

Those are common practices; the *package shape* (`agent.yaml` + entrypoint rules) is defined only by this platform. Full field reference: [docs/AGENT_CONTRACT.md](../docs/AGENT_CONTRACT.md).

Examples in this repo:

- [echo-agent](./echo-agent) — no network, no LLM, no cloud
- [aws-cost-agent](./aws-cost-agent) — AWS Cost Explorer totals by service and by resource (host `~/.aws` via `HOST_AWS_DIR`)

## Minimum requirements

1. An `agent.yaml` with at least: `apiVersion`, `id`, `name`, `version`, `entrypoint`
2. A Python callable at that entrypoint:

```python
def run(inputs: dict, context: dict | None = None) -> dict:
    ...
```

`context` may include `run_id`, `agent_id`, `agent_version`, `config`, and `llm`.

### Return value

Any of:

```python
{"echo": "hello"}  # treated as success output

{"success": True, "output": {...}}

{"success": False, "error": "...", "output": {...}}

# optional platform-friendly timeline entries:
{"success": True, "output": {...}, "steps": [{"name": "fetch", "status": "ok", "detail": "..."}]}
```

## Suggested package layout

```text
my-agent/
  agent.yaml
  README.md              # optional
  requirements.txt       # optional
  Dockerfile             # optional; else use runtime.image or platform default
  src/
    main.py              # e.g. entrypoint: src.main:run
```

Ship as a directory, or as `.zip` / `.tar.gz` / `.tgz` (archive may wrap a single top-level folder).

If `requirements.txt` is present, the Docker runner **`pip install`s it** at the start of each run (needs `permissions.network: true` to reach PyPI).

## Permissions and runtime

Set only what the agent needs in `agent.yaml`:

- `permissions.network` — required for outbound HTTP / LLM / cloud APIs / `pip install`
- `permissions.cloud_read` — when platform `HOST_AWS_DIR` is set, mounts that host `.aws` directory read-only into the run container; also documents cloud-read intent in your code
- `permissions.cloud_write` — document intent; enforce in your agent code
- `runtime.image` — custom image; `null` uses the platform default (`python:3.12-slim`)
- `runtime.timeout_seconds`, `memory_mb`, `cpu` — execution limits

Agents that call hosted or local LLMs should set `permissions.network: true` and usually declare `llm` defaults (overridable at install/config time in the UI). The `llm` block is **defaults only** — the platform does not auto-prompt.

## How execution, LLMs, and AWS work

Agents run as **programs** (default: isolated Docker containers calling `run(inputs, context)`).

**LLM (optional):** only used if **your agent code** calls one. There is no chat UI.

- The platform may pass resolved settings in `context["llm"]` (provider, model, API base).
- Local inference: `docker compose --profile llm up -d` starts Ollama and **auto-pulls** `DEFAULT_LLM_MODEL` (default `llama3`). Host port defaults to `11435`.
- Agents that never call a model (like `echo-agent` or `aws-cost-agent`) do not need the `llm` profile.

**AWS / cloud (optional):** for agents like `aws-cost-agent`, set `HOST_AWS_DIR` to your host `~/.aws` path and `permissions.cloud_read: true`. boto3 uses the normal CLI credential chain inside the container. See [aws-cost-agent/README.md](./aws-cost-agent/README.md) and [docs/INSTALL.md](../docs/INSTALL.md).

## Install into the platform

With the API running and an `API_TOKEN`:

**From a path the API container can see** (e.g. mounted under `/agents`):

```bash
curl -X POST http://localhost:8081/api/v1/agents/install/path \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"/agents/my-agent"}'
```

**Upload an archive:**

```bash
curl -X POST http://localhost:8081/api/v1/agents/install/upload \
  -H "Authorization: Bearer $API_TOKEN" \
  -F "file=@my-agent.zip"
```

Or use the Grafana **Agent Manager → Agents** page (install by path when the package is visible to the API).

Then configure, execute, and inspect runs under **History** / run details.

## Optional: validate a package locally

```bash
cd packages/agent-sdk
pip install -e .
python -c "from agent_sdk import validate_package_dir; print(validate_package_dir('/path/to/my-agent').manifest.id)"
```

## Checklist

- [ ] `agent.yaml` uses `apiVersion: amp/v1` and a unique `id`
- [ ] `entrypoint` is `module.path:function` and `run` exists
- [ ] `inputSchema` covers fields the UI should show
- [ ] Permissions/runtime match real needs (especially `network`)
- [ ] Package installs and a test execution succeeds in Agent Manager
