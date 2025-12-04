from django.urls import path
from . import views

urlpatterns = [
    path("", views.product_list),               # GET /api/products/
    path("manage/", views.product_create),      # POST /api/products/manage/
    path("<int:pk>/", views.product_detail),    # GET/PATCH/DELETE /api/products/12/
]
