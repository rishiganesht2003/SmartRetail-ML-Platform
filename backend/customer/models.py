from django.db import models
from django.contrib.auth.models import User
from products.models import Product

class CustomerBehavior(models.Model):
    ACTION_CHOICES = (
        ("view", "View"),
        ("click", "Click"),
        ("wishlist", "Wishlist"),
        ("cart", "Cart"),
        ("order", "Order"),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="behaviors")
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=32, choices=ACTION_CHOICES)
    metadata = models.JSONField(null=True, blank=True)  # allow additional info
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "-timestamp"]),
            models.Index(fields=["product", "-timestamp"]),
        ]

    def __str__(self):
        return f"{self.user.username} {self.action} {self.product_id or ''} @ {self.timestamp}"
