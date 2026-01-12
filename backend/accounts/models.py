from django.db import models
from django.contrib.auth.models import User


class Profile(models.Model):
    ROLE_CHOICES = (
        ("admin", "Admin"),
        ("customer", "Customer"),
    )

    # NOTE: 'staff' role removed project-wide per request

    SEGMENT_CHOICES = (
        ("VIP", "VIP"),
        ("LOYAL", "Loyal"),
        ("ACTIVE", "Active"),
        ("AT_RISK", "At Risk"),
        ("NEW", "New"),
        ("DORMANT", "Dormant"),
    )

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    full_name = models.CharField(max_length=150, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    # 🔹 cached ML segment (USED by segmentation + reco)
    customer_segment = models.CharField(
        max_length=20,
        choices=SEGMENT_CHOICES,
        null=True,
        blank=True,
        help_text="Cached ML customer segment",
    )

    def __str__(self):
        return f"{self.user.username} - {self.role}"


class Wallet(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="wallet"
    )
    balance_inr = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = "accounts_wallet"

    def __str__(self):
        return f"{self.user.username} - ₹{self.balance_inr}"


class WalletTransaction(models.Model):
    CREDIT_SOURCES = (
        ("topup", "Manual Top-up"),
        ("refund", "Refund"),
        ("upi", "UPI"),
        ("card", "Card"),
        ("cash", "Cash"),
        ("admin", "Admin Adjustment"),
        ("system", "System"),
    )

    TYPE_CHOICES = (
        ("credit", "Credit"),
        ("debit", "Debit"),
    )

    wallet = models.ForeignKey(
        Wallet, related_name="transactions", on_delete=models.CASCADE
    )
    txn_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    source = models.CharField(
        max_length=20, choices=CREDIT_SOURCES, default="system"
    )
    amount_inr = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=50, blank=True, null=True)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_wallet_txn"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.txn_type} ₹{self.amount_inr} ({self.source})"
