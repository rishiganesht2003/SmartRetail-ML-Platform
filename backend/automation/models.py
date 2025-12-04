from django.db import models

class AutomationModule(models.Model):
    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    accuracy = models.FloatField(default=0.0)
    weekly_impact = models.FloatField(default=0.0)
    description = models.TextField(blank=True)

    # Example: "dynamic_pricing", "restock", "recommendation"
    key = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class AutomationStats(models.Model):
    uptime = models.FloatField(default=99.0)
    hours_saved = models.IntegerField(default=0)
    next_retrain_days = models.IntegerField(default=7)

    def __str__(self):
        return "Automation Stats"
