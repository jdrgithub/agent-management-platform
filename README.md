# Agent Management Platform

Standalone platform for installing, configuring, executing, and monitoring AI agents through a portable Grafana App Plugin.

## Quick start

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:8081/health

cd plugin && npm install && npm run build
# then install plugin/dist into any Grafana — see docs/INSTALL.md
```

## Layout

| Path | Purpose |
|---|---|
| `backend/` | FastAPI management API + Docker execution engine |
| `plugin/` | Grafana App Plugin (`amp-agent-manager-app`) |
| `agents/` | Installable agent packages (includes `echo-agent`) |
| `packages/agent-sdk/` | Framework-independent agent contract |
| `docs/` | Install, contract, and local wiring notes |
| `docker-compose.yml` | Self-contained platform services |

## Features so far

- Agent package contract (`agent.yaml`) + SDK
- Registry API: install / uninstall / enable / disable / configure / execute / history
- Execution modes: `docker` (default, isolated) or `local`
- LiteLLM integration + optional Compose profile `llm` (Ollama)
- Grafana App Plugin: Agents, History, Configuration

## Docs

- [Writing agents](agents/README.md)
- [Install / wire to Grafana](docs/INSTALL.md)
- [Agent contract (field reference)](docs/AGENT_CONTRACT.md)
- [Local developer notes](docs/DEV_LOCAL.md)
