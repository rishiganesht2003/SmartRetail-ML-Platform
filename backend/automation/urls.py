from django.urls import path
from .views import AutomationCenterView, AutomationToggleView

urlpatterns = [
    path("center/", AutomationCenterView.as_view()),
    path("toggle/", AutomationToggleView.as_view()),
]
