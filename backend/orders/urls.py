from django.urls import path
import orders.views as views

urlpatterns = [
    # ==============================
    # ADMIN / STAFF – ORDERS
    # ==============================
    path("admin/orders/", views.admin_list_orders),
    path("admin/orders/<str:order_id>/", views.admin_order_detail),
    # Admin coupons list/create
    path("admin/coupons/", views.admin_coupons),

    # ==============================
    # CUSTOMER – ORDERS
    # ==============================
    path("orders/", views.customer_my_orders),
    path("orders/create/", views.create_customer_order),
    path("orders/<str:order_id>/", views.customer_order_detail),
    
    path("coupons/", views.customer_available_coupons),
    path("apply-coupon/", views.apply_coupon),
    path("admin/coupons/<int:coupon_id>/", views.admin_coupon_detail),
]
