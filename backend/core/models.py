from django.db import models
from django.conf import settings
from django.contrib.auth.models import User
from catalog.models import Product

UserModel = settings.AUTH_USER_MODEL


class StoreSettings(models.Model):
    store_name = models.CharField(max_length=255, blank=True, default="")
    currency = models.CharField(max_length=10, blank=True, default="INR")
    support_email = models.EmailField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")

    tax_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    shipping_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    two_factor_enabled = models.BooleanField(default=False)
    passwordless_login = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "store_settings"
        verbose_name = "Store Settings"
        verbose_name_plural = "Store Settings"

    def __str__(self):
        return "Store Settings"


class Notification(models.Model):
    TYPE_CHOICES = (
        ("info", "Info"),
        ("warning", "Warning"),
        ("success", "Success"),
    )

    user = models.ForeignKey(
        UserModel,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="info")
    is_new = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications_notification"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class CustomerAddress(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="addresses"
    )
    name = models.CharField(max_length=150)
    address_line = models.TextField()
    city = models.CharField(max_length=100)
    pincode = models.CharField(max_length=10)
    phone = models.CharField(max_length=15)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "customer_addresses"

    def __str__(self):
        return f"{self.name} - {self.city}"


class CustomerBehavior(models.Model):
    ACTION_CHOICES = (
        ("view", "View"),
        ("click", "Click"),
        ("wishlist", "Wishlist"),
        ("cart", "Cart"),
        ("order", "Order"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    product = models.ForeignKey(
        Product, null=True, blank=True, on_delete=models.SET_NULL
    )
    action = models.CharField(max_length=32, choices=ACTION_CHOICES)
    metadata = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "customer_behavior"

    def __str__(self):
        return f"{self.user.username} - {self.action}"
