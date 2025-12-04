from django.urls import path
from . import views

urlpatterns = [
    path("overview/", views.dynamic_pricing_overview),
    path("products/", views.pricing_products),   # ✅ ADD THIS
    path("price-changes/", views.price_changes_24h),
    path("apply-override/", views.apply_manual_override),
    path("settings/", views.update_pricing_settings),
]
