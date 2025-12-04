from django.contrib import admin
from django.urls import path, include
from django.conf import settings          
from django.conf.urls.static import static 

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/accounts/", include("accounts.urls")),
    path("api/admin/", include("accounts.urls")),
    path("api/products/", include("products.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/", include("inventory.urls")),
    path("api/automation/", include("automation.urls")),
    path("api/segmentation/", include("segmentation.urls")),
    path("api/pricing/", include("pricing.urls")),
    path("api/recommendation/", include("recommendation.urls")),
    path("api/reports/", include("reports.urls")),
    path('api/', include('admin_panel.urls')),
    path("api/", include("forecasting.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)