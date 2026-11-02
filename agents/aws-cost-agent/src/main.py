from __future__ import annotations

from datetime import date, timedelta
from typing import Any


def _service_from_resource_id(resource_id: str) -> str:
    if resource_id.startswith("arn:"):
        parts = resource_id.split(":")
        if len(parts) > 2:
            return parts[2]
    return ""


def _aggregate_groups(
    results_by_time: list[dict[str, Any]],
) -> tuple[dict[str, float], str]:
    totals: dict[str, float] = {}
    currency = "USD"
    for result in results_by_time:
        for group in result.get("Groups") or []:
            keys = group.get("Keys") or ["Unknown"]
            metric = (group.get("Metrics") or {}).get("UnblendedCost") or {}
            amount = float(metric.get("Amount") or 0)
            if amount == 0:
                continue
            currency = metric.get("Unit") or currency
            name = keys[0]
            totals[name] = totals.get(name, 0.0) + amount
    return totals, currency


def run(inputs: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Fetch Cost Explorer totals by service and by resource (with dollar amounts)."""
    steps: list[dict[str, Any]] = []
    lookback = int(inputs.get("lookback_days") or 30)
    lookback = max(1, min(lookback, 90))
    max_resources = int(inputs.get("max_resources") or 100)
    max_resources = max(1, min(max_resources, 500))

    try:
        import boto3
        from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError
    except ImportError as exc:
        return {
            "success": False,
            "error": f"boto3 not installed: {exc}",
            "output": {},
            "steps": steps,
        }

    session = boto3.Session()
    if session.get_credentials() is None:
        return {
            "success": False,
            "error": (
                "No AWS credentials found. Set HOST_AWS_DIR on the API to your host "
                "~/.aws path, ensure permissions.cloud_read is true, and restart the API."
            ),
            "output": {},
            "steps": steps,
        }

    end = date.today() + timedelta(days=1)  # Cost Explorer End exclusive
    start = end - timedelta(days=lookback)
    start_s, end_s = start.isoformat(), end.isoformat()
    # GetCostAndUsageWithResources supports at most 14 days.
    resource_lookback = min(lookback, 14)
    resource_start = end - timedelta(days=resource_lookback)
    resource_start_s = resource_start.isoformat()

    steps.append(
        {
            "name": "period",
            "status": "ok",
            "detail": f"services={start_s}..{end_s}; resources={resource_start_s}..{end_s}",
        }
    )

    try:
        ce = session.client("ce", region_name="us-east-1")
        usage = ce.get_cost_and_usage(
            TimePeriod={"Start": start_s, "End": end_s},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )
        steps.append({"name": "cost_by_service", "status": "ok", "detail": "GetCostAndUsage"})
    except NoCredentialsError as exc:
        return {
            "success": False,
            "error": f"AWS credentials rejected: {exc}",
            "output": {},
            "steps": steps,
        }
    except (ClientError, BotoCoreError) as exc:
        return {
            "success": False,
            "error": (
                f"Cost Explorer failed: {exc}. Enable Cost Explorer in the account "
                "(may take up to 24h) and ensure ce:GetCostAndUsage."
            ),
            "output": {},
            "steps": steps,
        }

    by_service, currency = _aggregate_groups(list(usage.get("ResultsByTime") or []))
    total = sum(by_service.values())
    cost_by_service = [
        {"service": name, "amount": round(amount, 4)}
        for name, amount in by_service.items()
        if round(amount, 4) != 0
    ]
    cost_by_service.sort(key=lambda row: row["amount"], reverse=True)

    cost_by_usage: list[dict[str, Any]] = []
    try:
        usage_type_resp = ce.get_cost_and_usage(
            TimePeriod={"Start": start_s, "End": end_s},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "USAGE_TYPE"}],
        )
        by_usage, _ = _aggregate_groups(list(usage_type_resp.get("ResultsByTime") or []))
        cost_by_usage = [
            {"usage_type": name, "amount": round(amount, 4)}
            for name, amount in by_usage.items()
            if round(amount, 4) != 0
        ]
        cost_by_usage.sort(key=lambda row: row["amount"], reverse=True)
        cost_by_usage = cost_by_usage[:max_resources]
        steps.append(
            {
                "name": "cost_by_usage",
                "status": "ok",
                "detail": f"returned={len(cost_by_usage)}",
            }
        )
    except (ClientError, BotoCoreError) as exc:
        steps.append({"name": "cost_by_usage", "status": "error", "detail": str(exc)})

    resources: list[dict[str, Any]] = []
    by_resource: dict[str, float] = {}
    resource_service: dict[str, str] = {}
    resource_errors: list[str] = []
    # API requires Filter; query each billed service separately (14-day window).
    for svc_row in cost_by_service:
        service_name = str(svc_row["service"])
        try:
            resource_usage = ce.get_cost_and_usage_with_resources(
                TimePeriod={"Start": resource_start_s, "End": end_s},
                Granularity="DAILY",
                Metrics=["UnblendedCost"],
                GroupBy=[{"Type": "DIMENSION", "Key": "RESOURCE_ID"}],
                Filter={
                    "Dimensions": {
                        "Key": "SERVICE",
                        "Values": [service_name],
                    }
                },
            )
            part, res_currency = _aggregate_groups(
                list(resource_usage.get("ResultsByTime") or [])
            )
            if res_currency:
                currency = res_currency
            for resource_id, amount in part.items():
                if not resource_id or resource_id in {"", "NoResourceId"}:
                    continue
                by_resource[resource_id] = by_resource.get(resource_id, 0.0) + amount
                resource_service[resource_id] = (
                    _service_from_resource_id(resource_id) or service_name
                )
        except (ClientError, BotoCoreError) as exc:
            resource_errors.append(f"{service_name}: {exc}")

    ranked = sorted(by_resource.items(), key=lambda item: item[1], reverse=True)
    for resource_id, amount in ranked[:max_resources]:
        if round(amount, 4) == 0:
            continue
        resources.append(
            {
                "resource_id": resource_id,
                "service": resource_service.get(resource_id, ""),
                "amount": round(amount, 4),
            }
        )

    if resources:
        steps.append(
            {
                "name": "cost_by_resource",
                "status": "ok",
                "detail": f"returned={len(resources)} cap={max_resources}",
            }
        )
    else:
        detail = "; ".join(resource_errors[:3]) if resource_errors else "empty"
        steps.append(
            {
                "name": "cost_by_resource",
                "status": "error" if resource_errors else "ok",
                "detail": detail,
            }
        )

    return {
        "success": True,
        "output": {
            "period": {
                "start": start_s,
                "end": end_s,
                "resources_start": resource_start_s,
            },
            "currency": currency,
            "total_cost": round(total, 4),
            "cost_by_service": cost_by_service,
            "cost_by_usage": cost_by_usage,
            "resources": resources,
            "profile": session.profile_name,
            "region": session.region_name,
        },
        "task_success": True,
        "steps": steps,
    }
