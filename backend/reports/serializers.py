from rest_framework import serializers

class ReportsSerializer(serializers.Serializer):
    months = serializers.ListField()
    sales = serializers.ListField()
    orders = serializers.ListField()
    aov = serializers.ListField()

    order_status = serializers.DictField()
    segments = serializers.DictField()
    inventory = serializers.DictField()
    pricing_impact = serializers.DictField()
    seasonal = serializers.DictField()
    top_products = serializers.DictField()
    users_growth = serializers.DictField()
    reco_ctr = serializers.DictField()
    automation_runs = serializers.DictField()

    kpis = serializers.DictField()
