from rest_framework import serializers
from ml_engine.models import AutomationModule, AutomationStats, ForecastCache


class AutomationModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationModule
        fields = "__all__"


class AutomationStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationStats
        fields = "__all__"


class ForecastCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = ForecastCache
        fields = "__all__"


class RecommendationSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    product_name = serializers.CharField()
    product_image = serializers.CharField()
    recommended_id = serializers.IntegerField()
    recommended_name = serializers.CharField()
    recommended_image = serializers.CharField()
    score = serializers.FloatField()
    reason = serializers.CharField()
