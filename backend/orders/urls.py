from django.urls import path
from .views import admin_list_orders, admin_order_detail, customer_my_orders

urlpatterns = [
    path("", admin_list_orders),
    path("<int:pk>/", admin_order_detail),
    path("customer/", customer_my_orders),
]
