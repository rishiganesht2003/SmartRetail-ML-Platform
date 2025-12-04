from django.shortcuts import render

# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import StoreSettings
from .serializers import StoreSettingsSerializer
from django.shortcuts import get_object_or_404

class AdminSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Return the first settings row (or defaults)
        settings = StoreSettings.objects.first()
        if not settings:
            # If no row exists, return defaults (no creation here)
            defaults = {
                "store_name": "",
                "currency": "INR",
                "support_email": "",
                "phone": "",
                "tax_percent": "0.00",
                "shipping_charge": "0.00",
                "two_factor_enabled": False,
                "passwordless_login": False,
                "id": None,
            }
            return Response(defaults, status=status.HTTP_200_OK)
        serializer = StoreSettingsSerializer(settings)
        return Response(serializer.data, status=status.HTTP_200_OK)

class UpdateAdminSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # If a settings row exists, update it; otherwise create one.
        settings = StoreSettings.objects.first()
        if settings:
            serializer = StoreSettingsSerializer(settings, data=request.data, partial=True)
        else:
            serializer = StoreSettingsSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
