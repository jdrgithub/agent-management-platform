# Installation

Standalone Agent Management Platform. Nothing here is tied to a specific host Grafana or network.

## 1. Start platform services

```bash
cp .env.example .env
# set API_TOKEN to a long random value
docker compose up -d --build
curl http://localhost:8081/health
```

### Optional local LLM (Ollama)

Starts Ollama and auto-pulls `DEFAULT_LLM_MODEL` (default `llama3`). This is **not** a chat UI — agents only use it if their code calls the model (via `context["llm"]` / HTTP to Ollama).

```bash
docker compose --profile llm up -d
# wait until ollama-init exits 0 (first pull can take several minutes)
docker compose --profile llm ps
curl http://localhost:11435/api/tags
```

Override the model in `.env` with `DEFAULT_LLM_MODEL=...`. Pull additional models anytime with:

```bash
docker compose exec ollama ollama pull <other-model>
```

### Optional AWS credentials for cloud agents

Agents with `permissions.cloud_read` (e.g. [`aws-cost-agent`](../agents/aws-cost-agent)) can use your host AWS CLI directory:

1. Set `HOST_AWS_DIR` in `.env` to the **host** path of `~/.aws` (example: `/home/you/.aws`).
2. Restart the API (`docker compose up -d --build api`).
3. The executor bind-mounts that directory read-only into the run container as `/root/.aws`.

No access keys are stored in the platform DB. Named profiles: pass `aws_profile` on execute or in agent config.

## 2. Build the Grafana App Plugin

```bash
cd plugin
npm install
npm run build
```

Output: `plugin/dist/` (plugin id `amp-agent-manager-app`).

## 3. Install into any Grafana (BYO)

1. Copy `plugin/dist` into your Grafana plugins directory as `amp-agent-manager-app/`:

   ```bash
   cp -a plugin/dist /var/lib/grafana/plugins/amp-agent-manager-app
   # or mount that path into the Grafana container
   ```

2. Allow the unsigned plugin id for local/dev builds:

   ```bash
   GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=amp-agent-manager-app
   ```

3. Restart Grafana.

4. In Grafana: **Administration → Plugins → Agent Manager → Enable**.

5. Open the plugin **Configuration** page and set:
   - **API URL** — reachable from the **browser** (usually `http://localhost:8081` or `http://<host-ip>:8081`)
   - **API Token** — same as `API_TOKEN` in `.env`

6. Use **Agents** / **History** pages to install, configure, execute, and uninstall agents.

### Notes

- The browser talks to the API directly (CORS enabled). The API URL is not “Grafana container → API”; it is “your laptop/browser → API”.
- For production multi-tenant Grafana, prefer a signed plugin and a backend proxy so tokens are not in `jsonData`.

## 4. Smoke-test agents

Echo (no network / no LLM / no AWS):

```bash
TOKEN=your-token
curl -X POST http://localhost:8081/api/v1/agents/install/path \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"/agents/echo-agent"}'
```

AWS cost sample (needs `HOST_AWS_DIR` and Cost Explorer IAM):

```bash
curl -X POST http://localhost:8081/api/v1/agents/install/path \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"/agents/aws-cost-agent"}'
```

Or use the plugin **Install** field with those paths (packages are mounted into the API container under `/agents`).

## Optional Compose profiles

| Profile | Purpose |
|---|---|
| `llm` | Platform Ollama on host port `11435`, plus auto-pull of `DEFAULT_LLM_MODEL` |
| `obs` | (later) Tempo / OTEL |
| `with-grafana` | (later) Bundled Grafana for greenfield |
