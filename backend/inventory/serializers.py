from rest_framework import serializers
from .models import InventoryItem, InventoryOptimizationCache

class InventoryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItem
        fields = [
            "id",
            "product_name",
            "category",
            "stock",
            "status",
            "depletion_days",
        ]

class InventoryOptimizationCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryOptimizationCache
        fields = "__all__"
