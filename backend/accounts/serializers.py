from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accounts.models import Profile, Wallet, WalletTransaction


# ==========================
# EXISTING (UNCHANGED)
# ==========================
class RegisterSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(write_only=True, required=True)
    role = serializers.ChoiceField(
        choices=Profile.ROLE_CHOICES,
        write_only=True,
        required=True,
    )
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "password",
            "full_name",
            "role",
        )

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        full_name = validated_data.pop("full_name")
        role = validated_data.pop("role")

        user = User.objects.create_user(**validated_data)

        Profile.objects.create(
            user=user,
            role=role,
            full_name=full_name,
            is_active=True,
        )

        return user

    def to_representation(self, instance):
        return {
            "id": instance.id,
            "username": instance.username,
            "email": instance.email,
            "role": instance.profile.role,
        }


# ==========================
# 🔹 NEW (ADDITIVE ONLY)
# ==========================
class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            "full_name",
            "role",
            "is_active",
            "customer_segment",
        ]


class UserMiniSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "profile"]


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ["balance_inr"]


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = [
            "txn_type",
            "source",
            "amount_inr",
            "description",
            "created_at",
        ]
