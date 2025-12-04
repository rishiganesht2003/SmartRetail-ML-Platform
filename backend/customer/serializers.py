from rest_framework import serializers

class ProductFeedSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    category = serializers.CharField(allow_blank=True)
    image = serializers.CharField(allow_null=True)
    price = serializers.DecimalField(max_digits=12, decimal_places=2)
    ai_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    rating = serializers.FloatField(required=False)
    stock = serializers.IntegerField(required=False)
    reason = serializers.CharField(required=False, allow_blank=True)
