# Agent contract

Every installable agent is a self-contained package with an `agent.yaml` manifest. Agents are independent of LangGraph, LiteLLM, and platform internals.

## Required files

| File | Required | Purpose |
|---|---|---|
| `agent.yaml` | yes | Manifest / contract |
| Entrypoint module | yes | Callable referenced by `entrypoint` |
| `requirements.txt` | no | Extra Python deps for runtime image |
| `Dockerfile` | no | Custom image; else use `runtime.image` |

## Manifest fields

```yaml
apiVersion: amp/v1
id: echo-agent                 # lowercase [a-z0-9-_]
name: Echo Agent
description: Returns inputs for platform smoke tests
version: 0.1.0
entrypoint: src.main:run       # module.path:function

inputSchema:
  type: object
  properties:
    message:
      type: string
  required: [message]

outputSchema:
  type: object
  properties:
    echo:
      type: string

dependencies: []               # optional pip/package hints
permissions:
  network: false
  filesystem_write: false
  cloud_read: false
  cloud_write: false
  docker_socket: false

llm:
  provider: ollama
  model: llama3

runtime:
  kind: docker
  image: null                  # null → platform default Python image
  python: "3.12"
  timeout_seconds: 120
  memory_mb: 512
  cpu: 1.0
  env: []                      # allowed env var names

tags: [example]
```

## Entrypoint

```python
def run(inputs: dict, context: dict | None = None) -> dict:
    return {"echo": inputs.get("message", "")}
```

`context` may include `run_id`, `agent_id`, `agent_version`, `config`, and `llm`.

## Package archives

Directories or archives (`.zip`, `.tar.gz`, `.tgz`) are accepted. Archives may contain a single top-level folder.
