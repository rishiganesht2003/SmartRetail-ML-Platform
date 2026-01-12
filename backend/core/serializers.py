from rest_framework import serializers
from core.models import StoreSettings, CustomerAddress


class StoreSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreSettings
        fields = [
            "id",
            "store_name",
            "currency",
            "support_email",
            "phone",
            "tax_percent",
            "shipping_charge",
            "two_factor_enabled",
            "passwordless_login",
        ]


class CustomerAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = [
            "id",
            "name",
            "address_line",
            "city",
            "pincode",
            "phone",
            "is_default",
        ]
