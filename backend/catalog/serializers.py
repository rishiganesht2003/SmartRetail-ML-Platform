from rest_framework import serializers
from django.db.models import Avg, Count

from catalog.models import Product, InventoryItem, ProductImage


class ProductImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ["id", "image", "is_primary"]

    def get_image(self, obj):
        return obj.get_image()


class ProductSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    rating = serializers.FloatField(read_only=True)
    rating_count = serializers.IntegerField(read_only=True)
    gallery = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "category",
            "description",
            "price",
            "base_price",
            "current_price",
            "price_source",
            "stock",
            "is_active",
            "image",
            "gallery",
            "rating",
            "rating_count",
            "created_at",
        ]

    def get_image(self, obj):
        return obj.image.url if obj.image else None


class InventoryItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = InventoryItem
        fields = ["id", "product_name", "stock", "created_at"]
