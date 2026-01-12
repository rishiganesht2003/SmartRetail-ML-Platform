from django.db import models
from django.conf import settings

UserModel = settings.AUTH_USER_MODEL


class AutomationModule(models.Model):
    name = models.CharField(max_length=100, unique=True)
    key = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    accuracy = models.FloatField(default=0.0)
    weekly_impact = models.FloatField(default=0.0)

    class Meta:
        db_table = "ml_engine_automation_module"

    def __str__(self):
        return self.name


class AutomationStats(models.Model):
    uptime = models.FloatField(default=99.0)
    hours_saved = models.IntegerField(default=0)
    next_retrain_days = models.IntegerField(default=7)

    class Meta:
        db_table = "ml_engine_automation_stats"

    def __str__(self):
        return "Automation Stats"


class AutomationConfig(models.Model):
    global_enabled = models.BooleanField(default=True)
    features = models.JSONField(default=dict)
    last_cached = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ml_engine_automation_config"

    def __str__(self):
        return f"AutomationConfig(global={self.global_enabled})"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class MLCache(models.Model):
    feature = models.CharField(max_length=100, db_index=True)
    payload = models.JSONField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ml_engine_cache"

    def __str__(self):
        return f"{self.feature} @ {self.updated_at}"


class SalesRecord(models.Model):
    order_id = models.CharField(max_length=128, unique=True)
    order_date = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "ml_engine_sales_record"


class ForecastCache(models.Model):
    model_name = models.CharField(max_length=64, default="prophet")
    horizon_months = models.IntegerField(default=3)
    forecast_next_month = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    confidence_score = models.DecimalField(max_digits=6, decimal_places=4, default=0.0)
    time_range = models.CharField(max_length=64, blank=True)
    actual = models.JSONField(default=dict)
    forecast = models.JSONField(default=dict)
    model_metrics = models.JSONField(default=dict)
    top_predictions = models.JSONField(default=list)
    insights = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ml_engine_forecast_cache"


class AutomationSetting(models.Model):
    feature_name = models.CharField(max_length=64, unique=True)
    enabled = models.BooleanField(default=True)
    selected_model = models.CharField(max_length=64, default="prophet")

    class Meta:
        db_table = "ml_engine_automation_setting"


class InventoryOptimizationCache(models.Model):
    summary = models.JSONField(default=dict)
    low_items = models.JSONField(default=list)
    critical_items = models.JSONField(default=list)
    insights = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ml_engine_inventory_optimization_cache"


class RecommendationLog(models.Model):
    admin = models.ForeignKey(
        UserModel,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="recommendation_logs",
    )
    product = models.IntegerField()
    recommended_product = models.IntegerField()
    score = models.FloatField(null=True, blank=True)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ml_engine_recommendation_log"
