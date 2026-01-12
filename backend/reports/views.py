from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings

import requests
try:
    import msal
except Exception:
    msal = None

from .powerbi_service import create_push_dataset_and_report
from .excel_service import generate_excel

from orders.models import Order, OrderItem
from catalog.models import Product
from accounts.models import Profile
from accounts.views import ensure_profile
from ml_engine.models import MLCache, AutomationConfig
from reports.models import SupportTicket


# ======================================================
# HELPERS
# ======================================================
def is_staff_or_admin(user):
    return ensure_profile(user).role in ("admin", "staff")


SUCCESS_STATUS = ["paid", "shipped", "delivered"]


# ======================================================
# REPORTS OVERVIEW (ADMIN + STAFF)
# ======================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reports_overview(request):
    if not is_staff_or_admin(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    now = timezone.now()
    start_6m = now - timedelta(days=180)

    orders = Order.objects.filter(status__in=SUCCESS_STATUS)

    # -------------------------
    # KPI SECTION
    # -------------------------
    total_revenue = orders.aggregate(v=Sum("total_inr"))["v"] or Decimal("0")
    total_orders = orders.count()
    customers = orders.values("customer").distinct().count()
    aov = float(total_revenue / total_orders) if total_orders else 0

    # forecast from ML cache
    forecast_cache = MLCache.objects.filter(
        feature="sales_forecasting"
    ).first()

    forecast_next_month = (
        forecast_cache.payload.get("forecast_next_month", 0)
        if forecast_cache else 0
    )

    # -------------------------
    # MONTHLY SALES CHART
    # -------------------------
    monthly = (
        orders
        .filter(placed_at__gte=start_6m)
        .annotate(month=TruncMonth("placed_at"))
        .values("month")
        .annotate(revenue=Sum("total_inr"), count=Count("id"))
        .order_by("month")
    )

    sales_labels = [m["month"].strftime("%b %Y") for m in monthly]
    sales_revenue = [float(m["revenue"]) for m in monthly]
    sales_orders = [m["count"] for m in monthly]

    # -------------------------
    # ORDER STATUS PIE
    # -------------------------
    status_data = (
        Order.objects
        .values("status")
        .annotate(count=Count("id"))
    )

    order_status = {
        s["status"]: s["count"] for s in status_data
    }

    # -------------------------
    # CUSTOMER SEGMENTS
    # -------------------------
    segments_qs = (
        Profile.objects
        .exclude(customer_segment__isnull=True)
        .values("customer_segment")
        .annotate(count=Count("id"))
    )

    segments = {
        s["customer_segment"]: s["count"]
        for s in segments_qs
    }

    # -------------------------
    # INVENTORY HEALTH
    # -------------------------
    inventory = {
        "total_products": Product.objects.count(),
        "low_stock": Product.objects.filter(stock__lte=5).count(),
        "out_of_stock": Product.objects.filter(stock__lte=0).count(),
    }

    # -------------------------
    # PRICING IMPACT
    # -------------------------
    pricing_cache = MLCache.objects.filter(
        feature="dynamic_pricing_overview"
    ).first()

    pricing = pricing_cache.payload if pricing_cache else {}

    # -------------------------
    # SEASONAL TRENDS
    # -------------------------
    seasonal_cache = MLCache.objects.filter(
        feature="seasonal_overview"
    ).first()

    seasonal = seasonal_cache.payload if seasonal_cache else {}

    # -------------------------
    # TOP PRODUCTS
    # -------------------------
    top_products_qs = (
        OrderItem.objects
        .values("product__name")
        .annotate(revenue=Sum("line_total"))
        .order_by("-revenue")[:5]
    )

    top_products = {
        "labels": [p["product__name"] for p in top_products_qs],
        "revenue": [float(p["revenue"]) for p in top_products_qs],
    }

    # -------------------------
    # USER GROWTH (MONTHLY)
    # -------------------------
    users_monthly = (
        Profile.objects
        .annotate(month=TruncMonth("user__date_joined"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )

    user_growth = {
        "labels": [
            u["month"].strftime("%b %Y") for u in users_monthly if u["month"]
        ],
        "counts": [u["count"] for u in users_monthly],
    }

    # -------------------------
    # RECOMMENDATION CTR (BASIC)
    # -------------------------
    reco_interactions = OrderItem.objects.count()
    reco_ctr = {
        "clicks": reco_interactions,
        "ctr": round(reco_interactions / max(customers, 1), 2),
    }

    # -------------------------
    # AUTOMATION USAGE
    # -------------------------
    cfg = AutomationConfig.get_solo()

    automation_runs = {
        "global_enabled": cfg.global_enabled,
        "features": cfg.features,
        "last_cached": cfg.last_cached,
    }

    # -------------------------
    # FINAL PAYLOAD (ALL CHART READY)
    # -------------------------
    payload = {
        "kpis": {
            "revenue": float(total_revenue),
            "orders": total_orders,
            "customers": customers,
            "aov": round(aov, 2),
            "forecast_next_month": forecast_next_month,
        },
        "sales": {
            "labels": sales_labels,
            "revenue": sales_revenue,
            "orders": sales_orders,
        },
        "order_status": order_status,
        "segments": segments,
        "inventory": inventory,
        "pricing": pricing,
        "seasonal": seasonal,
        "top_products": top_products,
        "user_growth": user_growth,
        "reco_ctr": reco_ctr,
        "automation_runs": automation_runs,
    }

    return Response(payload)


# ======================================================
# CUSTOMER SUPPORT
# ======================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_support_ticket(request):
    profile = ensure_profile(request.user)
    if profile.role != "customer":
        return Response(status=403)

    SupportTicket.objects.create(
        customer=request.user,
        name=request.data.get("name"),
        email=request.data.get("email"),
        message=request.data.get("message"),
    )

    return Response({"success": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def customer_my_tickets(request):
    profile = ensure_profile(request.user)
    if profile.role != "customer":
        return Response(status=403)

    tickets = SupportTicket.objects.filter(customer=request.user)

    return Response([
        {
            "id": t.id,
            "message": t.message,
            "status": t.status,
            "created_at": t.created_at,
        }
        for t in tickets
    ])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def powerbi_export(request):
    """
    Create/update a Power BI dataset and a report from the provided payload.

    Requirements (set in Django settings):
      POWERBI_TENANT_ID, POWERBI_CLIENT_ID, POWERBI_CLIENT_SECRET, POWERBI_GROUP_ID

    This endpoint expects the frontend to POST the full reports payload (the same
    shape returned by `reports_overview`). It will create a dataset in the
    configured Power BI workspace and then create a report bound to that dataset.

    Note: Full programmatic visual layout generation in Power BI is non-trivial
    and may require PBIX import or Power BI Embedded flows. This implementation
    focuses on creating a structured dataset and a report container and returns
    a webUrl for the user to open the generated report in Power BI service.
    """
    # authorization + role check
    profile = ensure_profile(request.user)
    if profile.role not in ("admin", "staff"):
        return Response({"detail": "Not authorized"}, status=403)

    payload = request.data or {}
    try:
        dataset_id, report_url = create_push_dataset_and_report(payload, request.user.username)
    except Exception as e:
        return Response({"detail": "Power BI export failed", "error": str(e)}, status=500)

    return Response({"ok": True, "dataset_id": dataset_id, "report_url": report_url})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def export_excel(request):
    profile = ensure_profile(request.user)
    if profile.role not in ("admin", "staff"):
        return Response({"detail": "Not authorized"}, status=403)

    payload = request.data or {}
    try:
        buf = generate_excel(payload)
    except Exception as e:
        return Response({"detail": "Excel generation failed", "error": str(e)}, status=500)

    from django.http import HttpResponse

    resp = HttpResponse(buf.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    resp["Content-Disposition"] = f'attachment; filename="smartretail_reports_{timezone.now().strftime("%Y%m%d_%H%M%S")}.xlsx"'
    return resp
