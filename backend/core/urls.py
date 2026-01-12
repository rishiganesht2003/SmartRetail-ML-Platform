from django.urls import path
from core import views

urlpatterns = [
    path("admin/settings/", views.AdminSettingsView.as_view()),
    path("admin/overview/", views.admin_overview),

    path("customer/addresses/", views.customer_addresses),
    path("customer/notifications/", views.customer_notifications),

    path("staff/overview/", views.staff_overview),
    path("staff/orders/", views.staff_list_orders),
    path("staff/orders/<int:pk>/", views.staff_order_detail),
    path("staff/low-stock/", views.staff_low_stock),

    path("staff/stock/", views.staff_stock_list),
    path("staff/stock/<int:product_id>/restock/", views.staff_stock_restock),
    path("staff/stock/<int:product_id>/", views.staff_stock_detail),

    path("staff/notifications/", views.staff_notifications),
]
