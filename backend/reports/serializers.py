# backend/reports/serializers.py

from rest_framework import serializers


class ReportsSerializer(serializers.Serializer):
    kpis = serializers.DictField()
    sales = serializers.DictField()
    order_status = serializers.DictField()
    segments = serializers.DictField()
    inventory = serializers.DictField()
    pricing = serializers.DictField()
    seasonal = serializers.DictField()
    top_products = serializers.DictField()
    user_growth = serializers.DictField()
    reco_ctr = serializers.DictField()
    automation_runs = serializers.DictField()
