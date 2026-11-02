# Installation

Standalone Agent Management Platform. Nothing here is tied to a specific host Grafana or network.

## 1. Start platform services

```bash
cp .env.example .env
# set API_TOKEN to a long random value
docker compose up -d --build
curl http://localhost:8081/health
```

Optional local LLM:

```bash
docker compose --profile llm up -d
# then pull a model inside the ollama service, e.g.:
docker compose exec ollama ollama pull llama3
```

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

## 4. Smoke-test agent

```bash
TOKEN=your-token
curl -X POST http://localhost:8081/api/v1/agents/install/path \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"/agents/echo-agent"}'
```

Or use the plugin **Install** field with path `/agents/echo-agent` (mounted into the API container).

## Optional Compose profiles

| Profile | Purpose |
|---|---|
| `llm` | Platform Ollama on published port `11435` |
| `obs` | (later) Tempo / OTEL |
| `with-grafana` | (later) Bundled Grafana for greenfield |
