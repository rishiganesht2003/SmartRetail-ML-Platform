from django.urls import path
from .views import segmentation_overview, segmentation_clusters

urlpatterns = [
    path("", segmentation_overview),
    path("clusters/", segmentation_clusters),
]
