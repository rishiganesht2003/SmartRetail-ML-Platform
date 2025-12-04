from django.db import models

class InventoryItem(models.Model):
    product_name = models.CharField(max_length=255)
    category = models.CharField(max_length=255)
    stock = models.IntegerField(default=0)

    # ML related fields
    status = models.CharField(max_length=20, default="good")  
    depletion_days = models.FloatField(default=0.0)  # ML-predicted

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class InventoryOptimizationCache(models.Model):
    summary = models.JSONField(default=dict)
    low_items = models.JSONField(default=list)
    critical_items = models.JSONField(default=list)
    insights = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inventory_optimization_cache"

    class Meta:
        db_table = "inventory_optimization_cache"


    class Meta:
        db_table = "inventory_items"

    def __str__(self):
        return self.product_name
