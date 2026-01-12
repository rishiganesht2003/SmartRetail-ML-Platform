from django.urls import path
from django.http import JsonResponse
from ml_engine import views

# Generic fallback view when a target view is missing
def _missing_view(request, *args, **kwargs):
    return JsonResponse({"detail": "Endpoint not implemented on server"}, status=501)

def _get_view(name):
    return getattr(views, name, _missing_view)

def _get_class_view(name):
    view_class = getattr(views, name, None)
    if view_class:
        return view_class.as_view()
    return _missing_view

urlpatterns = [
    # Automation
    path("automation/status/", _get_view("automation_status")),
    path("automation/update/", _get_view("automation_update")),
    path("automation/refresh_cache/", _get_view("automation_refresh_cache")),
    path("automation/center/", _get_class_view("AutomationCenterView")),
    path("automation/toggle/", _get_class_view("AutomationToggleView")),

    # Forecasting
    path("forecasting/overview/", _get_view("forecasting_overview")),
    path("forecasting/recompute/", _get_view("forecasting_recompute")),

    # Inventory
    path("inventory/overview/", _get_view("inventory_overview")),
    path("inventory/products/", _get_view("inventory_products")),
    path("inventory/recommend/", _get_view("inventory_recommend")),

    # Pricing
    path("pricing/overview/", _get_view("pricing_overview")),
    path("pricing/products/", _get_view("pricing_products")),
    path("pricing/apply/", _get_view("pricing_apply")),

    # Recommendations (CUSTOMER-FACING) - /api/ml/recommendations/...
    path("recommendations/overview/", _get_view("recommendations_overview")),
    path("recommendations/recommended/", _get_view("recommended_products")),
    path("recommendations/top/", _get_view("recommendation_top")),
    path("recommendations/for_product/", _get_view("recommendation_for_product")),
    path("recommendations/retrain/", _get_view("recommendation_retrain")),
    path("recommendations/log_apply/", _get_view("recommendation_log_apply")),

    # Recommendations (ADMIN ENDPOINTS) - /api/ml/recommendation/...
    path("recommendation/overview/", _get_view("recommendation_overview")),
    path("recommendation/products/", _get_view("recommendation_products")),
    path("recommendation/top/", _get_view("recommendation_top")),  # Use same as customer, just different cache key
    path("recommendation/for_product/", _get_view("recommendation_for_product")),

    # Seasonal
    path("seasonal/overview/", _get_view("seasonal_overview")),
    path("seasonal/predictions/", _get_view("seasonal_predictions")),
    path("seasonal/recompute/", _get_view("seasonal_recompute")),

    # Segmentation
    path("segmentation/overview/", _get_view("segmentation_overview")),
    path("segmentation/customers/", _get_view("segmentation_customers")),
    path("segmentation/my-segment/", _get_view("segmentation_my_segment")),
    path("segmentation/recompute_all/", _get_view("segmentation_recompute_all")),

    # Behavior
    path("behavior/record/", _get_view("record_behavior")),
    # Power BI report (pre-built .pbix removed)
    # Power BI template generation (optional .pbit download)
    path("powerbi/template/", _get_view("powerbi_template_download")),
    # Power BI alternative: generate self-contained HTML report
    path("powerbi/report_html/", _get_view("generate_html_report")),
]
