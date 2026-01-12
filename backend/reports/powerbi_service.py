import json
from django.conf import settings
from django.utils import timezone
import requests
try:
    import msal
except Exception:
    msal = None


def acquire_powerbi_token():
    tenant = getattr(settings, "POWERBI_TENANT_ID", None)
    client_id = getattr(settings, "POWERBI_CLIENT_ID", None)
    client_secret = getattr(settings, "POWERBI_CLIENT_SECRET", None)

    if not all([tenant, client_id, client_secret]):
        raise RuntimeError("Power BI credentials not configured")

    if msal is None:
        raise RuntimeError("msal not installed in server environment")

    authority = f"https://login.microsoftonline.com/{tenant}"
    app = msal.ConfidentialClientApplication(client_id, authority=authority, client_credential=client_secret)
    scope = ["https://analysis.windows.net/powerbi/api/.default"]
    token_resp = app.acquire_token_for_client(scopes=scope)
    if not token_resp or "access_token" not in token_resp:
        raise RuntimeError(f"Failed to acquire token: {token_resp}")

    return token_resp["access_token"]


def build_tables_from_payload(p):
    tables = []

    # Forecasting series
    f = p.get("forecasting") or {}
    if f:
        series = f.get("series") or {}
        labels = series.get("labels") or []
        predicted = series.get("predicted") or []
        rows = []
        for i, lbl in enumerate(labels):
            rows.append({"label": str(lbl), "predicted": float(predicted[i]) if i < len(predicted) and predicted[i] is not None else None})
        if rows:
            tables.append({
                "name": "Forecasting",
                "columns": [{"name": "label", "dataType": "string"}, {"name": "predicted", "dataType": "double"}],
                "rows": rows,
            })

    # Inventory (single-row summary)
    inv = p.get("inventory") or {}
    if inv:
        rows = [{k: (float(v) if isinstance(v, (int, float)) else str(v)) for k, v in inv.items()}]
        cols = [{"name": k, "dataType": ("double" if isinstance(v, (int, float)) else "string")} for k, v in inv.items()]
        tables.append({"name": "Inventory", "columns": cols, "rows": rows})

    # Pricing
    pr = p.get("pricing") or {}
    if pr:
        rows = [{k: (float(v) if isinstance(v, (int, float)) else str(v)) for k, v in pr.items()}]
        cols = [{"name": k, "dataType": ("double" if isinstance(v, (int, float)) else "string")} for k, v in pr.items()]
        tables.append({"name": "Pricing", "columns": cols, "rows": rows})

    # Recommendations
    reco = p.get("recommendations") or {}
    if reco:
        rows = [{k: (float(v) if isinstance(v, (int, float)) else str(v)) for k, v in reco.items()}]
        cols = [{"name": k, "dataType": ("double" if isinstance(v, (int, float)) else "string")} for k, v in reco.items()]
        tables.append({"name": "Recommendations", "columns": cols, "rows": rows})

    # Segmentation
    seg = p.get("segmentation") or {}
    segments = seg.get("segments") or {}
    if segments:
        rows = [{"segment": str(k), "count": float(v)} for k, v in segments.items()]
        tables.append({"name": "Segmentation", "columns": [{"name": "segment", "dataType": "string"}, {"name": "count", "dataType": "double"}], "rows": rows})

    # Seasonal
    s = p.get("seasonal") or {}
    if s and s.get("series"):
        labels = s["series"].get("labels", [])
        predicted = s["series"].get("predicted", [])
        rows = []
        for i, lbl in enumerate(labels):
            rows.append({"label": str(lbl), "value": float(predicted[i]) if i < len(predicted) and predicted[i] is not None else None})
        if rows:
            tables.append({"name": "Seasonal", "columns": [{"name": "label", "dataType": "string"}, {"name": "value", "dataType": "double"}], "rows": rows})

    return tables


def create_push_dataset_and_report(payload, username):
    """Create push dataset and a report in configured Power BI workspace.

    Returns (dataset_id, report_web_url)
    """
    group_id = getattr(settings, "POWERBI_GROUP_ID", None)
    if not group_id:
        raise RuntimeError("POWERBI_GROUP_ID not configured")

    token = acquire_powerbi_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    tables = build_tables_from_payload(payload)

    dataset_body = {"name": f"SmartRetail_Export_{username}_{int(timezone.now().timestamp())}", "defaultMode": "Push", "tables": []}
    for t in tables:
        ds_table = {"name": t["name"], "columns": [], "rows": t.get("rows", [])}
        for c in t["columns"]:
            ds_table["columns"].append({"name": c["name"], "dataType": c.get("dataType", "string")})
        dataset_body["tables"].append(ds_table)

    create_ds_url = f"https://api.powerbi.com/v1.0/myorg/groups/{group_id}/datasets?defaultRetentionPolicy=None"
    r = requests.post(create_ds_url, headers=headers, json=dataset_body, timeout=60)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Dataset create failed: {r.status_code} {r.text}")
    ds = r.json()
    dataset_id = ds.get("id")
    if not dataset_id:
        raise RuntimeError(f"Dataset response missing id: {ds}")

    # Create report bound to dataset
    create_report_url = f"https://api.powerbi.com/v1.0/myorg/groups/{group_id}/reports?datasetId={dataset_id}"
    rep_body = {"name": f"SmartRetail Report {username}"}
    rr = requests.post(create_report_url, headers=headers, json=rep_body, timeout=60)
    if rr.status_code not in (200, 201):
        # dataset created but report creation failed
        return dataset_id, None
    report = rr.json()
    web_url = report.get("webUrl") or report.get("embedUrl")
    return dataset_id, web_url
