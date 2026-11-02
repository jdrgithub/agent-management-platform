# Local developer notes

Product defaults are standalone. This file is optional convenience for developers who already have Grafana elsewhere.

## Useful ports

- Platform API: `http://localhost:8081`
- Platform Postgres: host `5433`
- Optional platform Ollama profile: host `11435`

## Rebuild & push plugin into a running Grafana container

```bash
./scripts/install-plugin-local.sh
# optional: GRAFANA_CONTAINER=my-grafana ./scripts/install-plugin-local.sh
```

Plugin settings (browser → API):

- API URL: `http://localhost:8081`
- API Token: value of `API_TOKEN` in `.env`

Do not commit host-specific networks or monitoring-stack paths into this repository.
