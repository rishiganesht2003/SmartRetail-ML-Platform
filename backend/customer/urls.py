from django.urls import path
from .views import PersonalizedFeedView, record_behavior

urlpatterns = [
    path("personalized-feed/", PersonalizedFeedView.as_view(), name="customer-personalized-feed"),
    path("behavior/", record_behavior, name="customer-behavior"),
]
