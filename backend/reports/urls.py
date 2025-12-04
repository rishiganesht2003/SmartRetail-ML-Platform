from django.urls import path
from .views import ReportsOverviewView

urlpatterns = [
    path("overview/", ReportsOverviewView.as_view(), name="reports-overview"),
]
