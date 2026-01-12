# backend/reports/models.py

from django.db import models
from django.contrib.auth.models import User


class MonthlySalesCache(models.Model):
    year = models.IntegerField()
    month = models.IntegerField()  # 1..12
    revenue = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    orders = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reports_monthlysalescache"
        unique_together = ("year", "month")

    def __str__(self):
        return f"{self.month}/{self.year}"


class SupportTicket(models.Model):
    STATUS_CHOICES = [
        ("open", "Open"),
        ("in_progress", "In Progress"),
        ("resolved", "Resolved"),
    ]

    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="support_tickets",
    )
    name = models.CharField(max_length=150)
    email = models.EmailField()
    message = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="open",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "support_tickets"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Ticket #{self.id}"
