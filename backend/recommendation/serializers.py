from rest_framework import serializers

class RecommendationSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    product_image = serializers.CharField(allow_blank=True, allow_null=True)
    recommended_id = serializers.IntegerField()
    recommended_name = serializers.CharField()
    recommended_image = serializers.CharField(allow_blank=True, allow_null=True)
    score = serializers.FloatField()
    reason = serializers.CharField()
