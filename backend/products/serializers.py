from rest_framework import serializers
from .models import Product

class ProductSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "category",
            "description",
            "price",
            "stock",
            "image",
            "created_at",
        ]

    def get_image(self, obj):
        if obj.image:
            return obj.image.url
        return None
