from django.db import models
from django.conf import settings

class RecommendationLog(models.Model):
    """
    Audit log for applied recommendations by admin.
    """
    admin = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    product = models.IntegerField(help_text="Product id the suggestion was for")
    recommended_product = models.IntegerField(help_text="Product id recommended")
    score = models.FloatField(null=True, blank=True)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "recommendation_log"

    def __str__(self):
        return f"Reco {self.product} -> {self.recommended_product} by {self.admin}"
