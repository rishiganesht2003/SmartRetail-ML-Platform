from django.urls import path
from .views import InventoryListView, InventoryInsightsView

urlpatterns = [
    path("admin/inventory/", InventoryListView.as_view()),
    path("admin/inventory/insights/", InventoryInsightsView.as_view()),
]
