from django.utils import timezone
from django.db.models import Sum
from datetime import timedelta
from decimal import Decimal
from ml_engine.models import AutomationConfig, MLCache
from catalog.models import Product, PriceAdjustment
from orders.models import OrderItem

DEFAULT_FEATURES = {
    "dynamic_pricing": True,
    "inventory_optimization": True,
    "customer_segmentation": True,
    "seasonal_trends": True,
    "sales_forecasting": True,
    "recommendation_engine": True,
}


def ensure_config() -> AutomationConfig:
    cfg, _ = AutomationConfig.objects.get_or_create(
        pk=1,
        defaults={
            "global_enabled": True,
            "features": DEFAULT_FEATURES,
            "last_cached": {},
        },
    )

    # 🔒 STRICT feature normalization (NO extra keys allowed)
    normalized = {}
    for key, default_val in DEFAULT_FEATURES.items():
        normalized[key] = (
            cfg.features.get(key, default_val)
            if isinstance(cfg.features, dict)
            else default_val
        )

    cfg.features = normalized

    if cfg.last_cached is None:
        cfg.last_cached = {}

    cfg.save(update_fields=["features", "last_cached"])
    return cfg


def mark_feature_cached(cfg: AutomationConfig, feature_key: str):
    if not cfg.global_enabled:
        return

    if not cfg.features.get(feature_key, True):
        return

    if cfg.last_cached is None:
        cfg.last_cached = {}

    cfg.last_cached[feature_key] = timezone.now().isoformat()
    cfg.save(update_fields=["last_cached"])


def can_view_pricing(user):
    try:
        return user.profile.role in ("admin", "staff")
    except Exception:
        return False


def get_product_sales_last_30_days(product_id: int) -> int:
    """Calculate total units sold in last 30 days"""
    now = timezone.now()
    since = now - timedelta(days=30)

    total = OrderItem.objects.filter(
        product_id=product_id,
        order__placed_at__gte=since,
        order__status__in=["paid", "shipped", "delivered"],
    ).aggregate(total=Sum("quantity"))["total"]

    return total or 0


def automation_meta(feature_key):
    cfg = ensure_config()
    feature_enabled = cfg.features.get(feature_key, False)

    if not cfg.global_enabled or not feature_enabled:
        mode = "OFF"
    else:
        mode = "LIVE"

    return {
        "global_enabled": cfg.global_enabled,
        "feature_enabled": feature_enabled,
        "mode": mode,
    }


def apply_dynamic_pricing(product: Product):
    """Apply dynamic pricing to a single product"""
    cfg = ensure_config()
    live = cfg.global_enabled and cfg.features.get("dynamic_pricing", True)
    mode = "LIVE" if live else "CACHED"

    # 🔁 CACHED MODE
    if not live:
        cache = MLCache.objects.filter(
            feature="dynamic_pricing_product",
        ).first()

        if cache and str(product.id) in cache.payload:
            return float(cache.payload[str(product.id)]), mode

        return float(product.current_price or product.base_price), mode

    # 🔥 LIVE MODE - Calculate dynamic price
    base_price = Decimal(str(product.base_price or product.price or 0))

    if base_price <= 0:
        return float(product.current_price or product.base_price), mode

    # Get sales velocity (units sold in last 30 days)
    units_sold_30d = get_product_sales_last_30_days(product.id)

    # Demand factor: 0-1 scale (higher sales = higher multiplier)
    demand_factor = Decimal(str(min(1.0, units_sold_30d / 100.0)))

    # Inventory factor: 0.8-1.2 based on stock level
    stock = product.stock or 1
    inventory_factor = Decimal(str(max(0.8, min(1.2, stock / 50.0))))

    # Calculate new price
    new_price = base_price * (Decimal("1.0") + demand_factor * Decimal("0.15")) * inventory_factor
    new_price = max(
        base_price * Decimal("0.80"),
        min(new_price, base_price * Decimal("1.25"))
    ).quantize(Decimal("0.01"))

    # Update product
    product.current_price = new_price
    product.price_source = "dynamic"
    product.last_price_update = timezone.now()
    product.save(update_fields=["current_price", "price_source", "last_price_update"])

    # Create price adjustment record
    old_price = product.base_price or product.price
    if new_price != old_price:
        PriceAdjustment.objects.create(
            product=product,
            old_price=old_price,
            new_price=new_price,
            percentage_change=float(((new_price - old_price) / old_price) * 100),
        )

    # 💾 Cache result
    cache_payload = {str(product.id): float(new_price)}
    MLCache.objects.update_or_create(
        feature="dynamic_pricing_product",
        defaults={"payload": cache_payload},
    )

    return float(new_price), mode
