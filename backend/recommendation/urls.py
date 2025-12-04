from django.urls import path
from . import views

urlpatterns = [
    path("overview/", views.overview),
    path("top/", views.top_recommendations),
    path("for_product/", views.for_product),
    path("retrain/", views.retrain),
    path("log_apply/", views.log_apply),
]
