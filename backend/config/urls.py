from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    # =========================
    # DJANGO ADMIN
    # =========================
    path("admin/", admin.site.urls),

    # =========================
    # API ROUTES
    # =========================
    path("api/accounts/", include("accounts.urls")),
    path("api/core/", include("core.urls")),
    path("api/catalog/", include("catalog.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/ml/", include("ml_engine.urls")),
    path("api/reports/", include("reports.urls")),
]


# =========================
# MEDIA FILES (DEV ONLY)
# =========================
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )
