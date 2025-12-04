from rest_framework import serializers
from .models import AutomationModule, AutomationStats


class AutomationModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationModule
        fields = [
            "id",
            "name",
            "key",
            "description",
            "is_active",
            "accuracy",
            "weekly_impact",
        ]


class AutomationStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationStats
        fields = [
            "uptime",
            "hours_saved",
            "next_retrain_days",
        ]
