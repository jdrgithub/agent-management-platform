# AWS Cost Agent

Reports **totals by AWS service** and **spend by resource** (Cost Explorer dollar amounts). No LLM involved.

## Credentials

Uses the host AWS CLI directory (`~/.aws`), mounted into the run container:

1. In platform `.env`, set `HOST_AWS_DIR` to the **host** path of your `.aws` directory (e.g. `/home/you/.aws`).
2. Restart the API so it picks up the env var.
3. Manifest has `permissions.cloud_read: true` so the executor bind-mounts that path read-only to `/root/.aws`.

Optional named profile: pass `aws_profile` on execute, or set `aws_profile` in agent config.

IAM (minimum):

- `ce:GetCostAndUsage`
- `ce:GetCostAndUsageWithResources`

Enable **Cost Explorer** and **resource-level data** in the billing console (can take up to ~24h after enable).

## Install

```bash
curl -X POST http://localhost:8081/api/v1/agents/install/path \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"/agents/aws-cost-agent"}'
```

## Run

```bash
curl -X POST http://localhost:8081/api/v1/agents/aws-cost-agent/execute \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputs":{"lookback_days":30,"max_resources":100}}'
```

## Output

- `total_cost` / `cost_by_service` — full lookback (up to 90 days)
- `resources` — each row is a resource id **with an amount**; sorted highest spend first. AWS caps this API at **14 days**.

## Limits

- Per-resource costs require Cost Explorer resource-level data.
- Resource window max is 14 days (AWS API), even if `lookback_days` is larger.
