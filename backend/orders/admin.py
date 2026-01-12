from django.contrib import admin

from orders.models import (
    Order,
    OrderItem,
    Coupon,
)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "order_id",
        "customer",
        "total_inr",
        "status",
        "payment_method",
        "placed_at",
    )
    search_fields = ("order_id", "customer__username")
    list_filter = ("status", "payment_method")
    ordering = ("-placed_at",)


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = (
        "order",
        "product",
        "quantity",
        "price_at_purchase",
        "line_total",
        "status",
    )
    list_filter = ("status",)
    search_fields = ("order__order_id", "product__name")


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "discount_amount",
        "is_active",
    )
    list_filter = ("is_active",)
    search_fields = ("code",)

