# catalog/services/pricing.py
from catalog.models import Product
from ml_engine.services import is_feature_live




def apply_dynamic_pricing(product):
    live, mode = is_feature_live("dynamic_pricing")

    if not live:
        return product.current_price, mode

    # simple logic (already aligned with your ML plan)
    demand_factor = product.sales_last_30_days / 100
    inventory_factor = max(0.8, min(1.2, product.stock / 50))

    new_price = product.base_price * (1 + demand_factor) * inventory_factor

    product.current_price = round(new_price, 2)
    product.price_source = "dynamic"
    product.save(update_fields=["current_price", "price_source"])

    return product.current_price, "LIVE"
