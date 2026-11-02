# AMP Agent SDK

Framework-independent contract for installable agents.

Agents **do not** need LangGraph, LiteLLM, or any platform internals. They must ship an `agent.yaml` manifest and an entrypoint that accepts structured inputs and returns structured outputs.

## Package layout

```text
my-agent/
  agent.yaml          # required manifest
  README.md           # optional
  requirements.txt    # optional Python deps for the runtime image
  Dockerfile          # optional; otherwise use runtime.image
  src/
    main.py           # entrypoint module
```

## Entrypoint signature

```python
def run(inputs: dict, context: dict | None = None) -> dict:
    ...
```

Return either a plain output object (treated as success) or:

```python
{"success": True, "output": {...}}
# or
{"success": False, "error": "...", "output": {...}}
```
