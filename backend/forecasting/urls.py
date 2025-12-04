from django.urls import path
from .views import SalesForecastingView, GenerateForecastView

urlpatterns = [
    path("admin/sales_forecasting/", SalesForecastingView.as_view(), name="api-admin-sales-forecast"),
    path("admin/sales_forecasting/generate/", GenerateForecastView.as_view(), name="api-admin-sales-forecast-generate"),
]
