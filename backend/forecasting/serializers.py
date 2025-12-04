from rest_framework import serializers
from .models import SalesRecord, ForecastCache, AutomationSetting

class SalesRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesRecord
        fields = ["order_id", "order_date", "total_amount"]


class ForecastCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = ForecastCache
        fields = [
            "id",
            "model_name",
            "horizon_months",
            "forecast_next_month",
            "confidence_score",
            "time_range",
            "actual",
            "forecast",
            "model_metrics",
            "top_predictions",
            "insights",
            "created_at",
            "updated_at",
        ]


class AutomationSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationSetting
        fields = ["feature_name", "enabled", "selected_model", "updated_at"]
