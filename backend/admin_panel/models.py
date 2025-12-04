# Create your models here.
from django.db import models
from django.utils import timezone

class StoreSettings(models.Model):
    # Single-row settings table. We'll rely on the first (or create one if none).
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
        return f"StoreSettings(id={self.pk})"
