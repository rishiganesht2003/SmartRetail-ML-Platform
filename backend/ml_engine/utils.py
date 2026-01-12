# ml_engine/utils.py

from ml_engine.models import AutomationConfig


def ensure_config():
    """
    Always return a single AutomationConfig row.
    Creates one if missing.
    """
    cfg, _ = AutomationConfig.objects.get_or_create(
        id=1,
        defaults={
            "global_enabled": True,
            "features": {
                "dynamic_pricing": True,
                "recommendation": True,
                "customer_segmentation": True,
                "sales_forecasting": True,
                "inventory_optimization": True,
                "seasonal_trends": True,
            },
        },
    )
    return cfg


def is_feature_live(feature_key: str):
    """
    Returns:
    (True, "LIVE")     → ML runs
    (False, "CACHED")  → use cached values
    (False, "OFF")     → fully off
    """
    cfg = ensure_config()

    if not cfg.global_enabled:
        return False, "OFF"

    if not cfg.features.get(feature_key, False):
        return False, "CACHED"

    return True, "LIVE"
