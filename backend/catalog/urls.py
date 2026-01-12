from django.urls import path
from catalog import views


urlpatterns = [
    path("admin/products/", views.admin_products),
    path("admin/products/<int:pk>/", views.admin_product_detail),

    path("products/", views.customer_products),
    path("products/<int:product_id>/", views.customer_product_detail),

    path("wishlist/", views.customer_wishlist),
    path("wishlist/add/", views.add_to_wishlist),
    path("wishlist/remove/", views.remove_from_wishlist),

    path("pricing/overview/", views.dynamic_pricing_overview),
    path("pricing/products/", views.pricing_products),
    path("pricing/apply-override/", views.apply_manual_override),
    path("pricing/apply/", views.apply_pricing_wrapper),
]
