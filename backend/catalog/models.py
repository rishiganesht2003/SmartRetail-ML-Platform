from django.conf import settings
from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal


def product_image_upload_path(instance, filename):
    return f"products/{filename}"


class Product(models.Model):
    PRICE_SOURCE_CHOICES = (
        ("manual", "Manual"),
        ("dynamic", "Dynamic"),
        ("cached", "Cached"),
        ("override", "Override"),
    )

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, blank=True, null=True)
    category = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)

    # 🔹 EXISTING – DO NOT REMOVE
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # 🔹 Dynamic pricing foundation
    base_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    price_source = models.CharField(
        max_length=20, choices=PRICE_SOURCE_CHOICES, default="manual"
    )
    last_price_update = models.DateTimeField(null=True, blank=True)

    stock = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    image = models.ImageField(
        upload_to=product_image_upload_path, null=True, blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "products_product"

    def save(self, *args, **kwargs):
        # Convert fields to Decimal to handle potential string values from DB or input
        current_price_val = Decimal(self.current_price or 0)
        base_price_val = Decimal(self.base_price or 0)
        price_val = Decimal(self.price or 0)

        # Auto-populate current_price if not set
        if not current_price_val or current_price_val <= 0:
            self.current_price = base_price_val or price_val or Decimal("99.99")

        # Auto-populate base_price if not set
        if not base_price_val or base_price_val <= 0:
            self.base_price = price_val or Decimal("99.99")

        # Ensure price field is set
        if not price_val or price_val <= 0:
            self.price = Decimal(self.current_price) or Decimal("99.99")

        # Ensure stock has a default value (if 0, set to 50)
        if self.stock == 0 or self.stock is None:
            self.stock = 50  # Default stock if not specified

        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class InventoryItem(models.Model):
    product = models.OneToOneField(
        Product, on_delete=models.CASCADE, related_name="inventory"
    )
    stock = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "catalog_inventory"

    def __str__(self):
        return self.product.name


class PriceAdjustment(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    old_price = models.DecimalField(max_digits=10, decimal_places=2)
    new_price = models.DecimalField(max_digits=10, decimal_places=2)
    percentage_change = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "catalog_price_adjustment"

    def __str__(self):
        return f"{self.product.name} → {self.new_price}"


# ✅ MERGED ProductReview (DUPLICATE FIX)
class ProductReview(models.Model):
    product = models.ForeignKey(
        Product, related_name="reviews", on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    rating = models.PositiveSmallIntegerField()  # 1–5
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "catalog_product_review"
        unique_together = ("product", "user")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.product.name} - {self.rating}/5"


class Wishlist(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "catalog_wishlist"
        unique_together = ("user", "product")

    def __str__(self):
        return f"{self.user.username} - {self.product.name}"


class ProductImage(models.Model):
    product = models.ForeignKey(
        Product, related_name="gallery", on_delete=models.CASCADE
    )
    image = models.ImageField(
        upload_to="products/", null=True, blank=True
    )
    image_url = models.URLField(max_length=500, null=True, blank=True)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def get_image(self):
        if self.image:
            return self.image.url
        return self.image_url

    def __str__(self):
        return f"{self.product.name} image"
