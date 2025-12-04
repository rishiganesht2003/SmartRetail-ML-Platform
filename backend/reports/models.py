from django.db import models

class MonthlySalesCache(models.Model):
    year = models.IntegerField()
    month = models.IntegerField()  # 1..12
    revenue = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    orders = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reports_monthlysalescache"
        unique_together = ("year", "month")
