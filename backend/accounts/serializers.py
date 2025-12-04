# accounts/serializers.py
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Profile

class RegisterSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(write_only=True, required=True)
    role = serializers.CharField(write_only=True, required=True)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "full_name", "role")

    def create(self, validated_data):
        full_name = validated_data.pop("full_name")
        role = validated_data.pop("role")

        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )

        Profile.objects.create(
            user=user,
            role=role,
            full_name=full_name
        )

        return user

    def to_representation(self, instance):
        # Return only safe user fields
        return {
            "id": instance.id,
            "username": instance.username,
            "email": instance.email
        }
