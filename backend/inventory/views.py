from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Avg

from products.models import Product   # ⭐ using your existing products table
from .models import InventoryOptimizationCache
from .serializers import InventoryOptimizationCacheSerializer


# Helper to auto classify stock level
def get_status(stock):
    if stock == 0:
        return "critical"
    if stock <= 20:
        return "low"
    return "good"


def estimate_depletion(stock):
    # Temporary logic — replace later with ML predictions
    if stock == 0:
        return 0
    if stock <= 20:
        return 5
    if stock <= 50:
        return 10
    return 20


class InventoryListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        products = Product.objects.all().order_by("name")

        data = []

        for p in products:
            stock = p.stock if hasattr(p, "stock") else 0

            data.append({
                "id": p.id,
                "product_name": p.name,
                "category": p.category if hasattr(p, "category") else "General",
                "stock": stock,
                "status": get_status(stock),
                "depletion_days": estimate_depletion(stock),
            })

        return Response(data)


class InventoryInsightsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):

        products = Product.objects.all()

        # Summaries
        stocks = [
            p.stock if hasattr(p, "stock") else 0
            for p in products
        ]

        statuses = [get_status(s) for s in stocks]

        summary = {
            "well_stocked": statuses.count("good"),
            "low": statuses.count("low"),
            "critical": statuses.count("critical"),
            "avg_depletion": (
                sum(estimate_depletion(s) for s in stocks) / len(stocks)
                if len(stocks) else 0
            )
        }

        # Low items
        low_items = [
            {
                "name": p.name,
                "stock": p.stock,
                "depletion": estimate_depletion(p.stock),
            }
            for p in products if get_status(p.stock) == "low"
        ]

        # Critical items
        critical_items = [
            {
                "name": p.name,
                "stock": p.stock,
                "depletion": estimate_depletion(p.stock),
            }
            for p in products if get_status(p.stock) == "critical"
        ]

        # Simple insights
        insights = []
        if len(critical_items):
            insights.append("⚠ Critical stock detected — urgent restocking required.")
        if len(low_items):
            insights.append("🟡 Several items running low — consider replenishing soon.")
        if summary["avg_depletion"] < 10:
            insights.append("📉 Fast depletion rate — demand is increasing.")

        return Response({
            "summary": summary,
            "low_items": low_items,
            "critical_items": critical_items,
            "insights": insights,
        })
