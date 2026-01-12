# backend/orders/models.py

from django.db import models
from django.contrib.auth.models import User
from catalog.models import Product


class Order(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("paid", "Paid"),
        ("failed", "Failed"),
        ("shipped", "Shipped"),
        ("delivered", "Delivered"),
        ("cancelled", "Cancelled"),
    )

    id = models.BigAutoField(primary_key=True)
    order_id = models.CharField(max_length=64, unique=True)

    customer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="orders",
    )

    total_inr = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES)

    payment_method = models.CharField(max_length=20, default="COD")
    payment_meta = models.JSONField(default=dict, blank=True)

    coupon_code = models.CharField(max_length=50, null=True, blank=True)
    discount_inr = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )

    address_snapshot = models.JSONField(default=dict)
    items_snapshot = models.JSONField(default=list)

    placed_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "orders_order"
        indexes = [
            models.Index(fields=["order_id"]),
            models.Index(fields=["customer"]),
        ]

    def __str__(self):
        return self.order_id


class OrderItem(models.Model):
    STATUS_CHOICES = (
        ("normal", "Normal"),
    )

    order = models.ForeignKey(
        Order, related_name="items", on_delete=models.CASCADE
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE)

    quantity = models.IntegerField(default=1)

    # 🔹 EXISTING (kept for backward compatibility)
    price_inr = models.DecimalField(max_digits=10, decimal_places=2)

    # 🔹 NEW — SNAPSHOT OF PRODUCT PRICE AT PURCHASE TIME
    price_at_purchase = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Final product price at time of order (after dynamic pricing)",
        null=True,
        blank=True,
    )

    line_total = models.DecimalField(max_digits=10, decimal_places=2)

    status = models.CharField(
        max_length=30, choices=STATUS_CHOICES, default="normal"
    )

    class Meta:
        db_table = "orders_orderitem"

    def __str__(self):
        return f"{self.order.order_id} - {self.product.name}"


class Coupon(models.Model):
    PAYMENT_CHOICES = (
        ("UPI", "UPI"),
        ("Card", "Card"),
        ("COD", "Cash On Delivery"),
    )

    code = models.CharField(max_length=20, unique=True)
    # Fixed amount discount (INR). Keep for backward compatibility.
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Optional percentage discount (0-100). If >0, percentage discount is applied
    # on the order subtotal. Stored as Decimal to avoid floating point issues.
    discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Percentage discount (e.g. 10.5 for 10.5%)"
    )
    is_active = models.BooleanField(default=True)

    allowed_payment_methods = models.JSONField(
        default=list,
        blank=True,
        help_text="Empty = allowed for all payment methods"
    )

    def __str__(self):
        return self.code
