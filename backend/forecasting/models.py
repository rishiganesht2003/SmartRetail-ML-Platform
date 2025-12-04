from django.db import models
from django.utils import timezone
# Use models.JSONField (Django 3.1+) -- works with MySQL 5.7+
class SalesRecord(models.Model):
    order_id = models.CharField(max_length=128, unique=True)
    order_date = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "sales_record"
        ordering = ["-order_date"]

    def __str__(self):
        return f"{self.order_id} - {self.order_date} - {self.total_amount}"


class ForecastCache(models.Model):
    """
    Stores last generated forecast for a model/horizon. We keep full payload JSON to return
    to frontend quickly. This is the cache that Automation Center will use when ML toggles off.
    """
    model_name = models.CharField(max_length=64, default="prophet")
    horizon_months = models.IntegerField(default=3)
    forecast_next_month = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    confidence_score = models.DecimalField(max_digits=6, decimal_places=4, default=0.0)
    time_range = models.CharField(max_length=64, blank=True, default="")
    actual = models.JSONField(default=dict)
    forecast = models.JSONField(default=dict)
    model_metrics = models.JSONField(default=dict)
    top_predictions = models.JSONField(default=list)
    insights = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "forecast_cache"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"ForecastCache({self.model_name}, horizon={self.horizon_months})"


class AutomationSetting(models.Model):
    """
    Small table to hold automation toggles and selected model for features.
    Example: feature_name = 'sales_forecasting'
    """
    feature_name = models.CharField(max_length=64, unique=True)
    enabled = models.BooleanField(default=True)  # if false, use cached results only
    selected_model = models.CharField(max_length=64, default="prophet")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "automation_setting"

    def __str__(self):
        return f"{self.feature_name}: enabled={self.enabled} model={self.selected_model}"
