from django.db import models

def product_image_upload_path(instance, filename):
    return f"products/{filename}"

class Product(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, blank=True, null=True)
    category = models.CharField(max_length=120, blank=True)  # STRING CATEGORY
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    stock = models.IntegerField(default=0)
    image = models.ImageField(upload_to=product_image_upload_path,
                              null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "products_product"

    def __str__(self):
        return self.name
