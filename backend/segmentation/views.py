from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Avg

from accounts.models import Profile
from orders.models import Order, OrderItem


# ----------------------------------------------------
# Helper – compute total spend per customer
# ----------------------------------------------------
def compute_customer_spend():
    data = {}  # {customer_id: total_spend}

    items = (
        OrderItem.objects
        .select_related("order", "order__customer")
        .values("order__customer_id")
        .annotate(total=Sum("line_total"))
    )

    for row in items:
        cid = row["order__customer_id"]
        if cid:
            data[cid] = float(row["total"] or 0)

    return data


# ----------------------------------------------------
# GET /api/segmentation/
# ----------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def segmentation_overview(request):
    # Only admin/staff can access
    role = request.user.profile.role
    if role not in ["admin", "staff"]:
        return Response({"detail": "Not authorized"}, status=403)

    spend_map = compute_customer_spend()

    total_customers = len(spend_map)

    if total_customers == 0:
        return Response({
            "total_customers": 0,
            "high_value": 0,
            "at_risk": 0,
            "avg_ltv": 0,
            "sample_profiles": []
        })

    values = list(spend_map.values())
    avg_ltv = round(sum(values) / len(values), 2)

    # Simple segmentation logic
    high_value = sum(1 for s in values if s >= 5000)
    at_risk = sum(1 for s in values if s < 1000)

    # Sample profiles
    profiles = []
    sample_profiles_qs = Profile.objects.filter(user_id__in=list(spend_map.keys()))[:4]

    for p in sample_profiles_qs:
        profiles.append({
            "name": p.user.get_full_name() or p.user.username,
            "email": p.user.email,
            "cluster": "High Value" if spend_map.get(p.user.id, 0) >= 5000 else (
                        "At Risk" if spend_map.get(p.user.id, 0) < 1000 else "Regular"
                      )
        })

    return Response({
        "total_customers": total_customers,
        "high_value": high_value,
        "at_risk": at_risk,
        "avg_ltv": avg_ltv,
        "sample_profiles": profiles
    })


# ----------------------------------------------------
# GET /api/segmentation/clusters/
# ----------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def segmentation_clusters(request):

    role = request.user.profile.role
    if role not in ["admin", "staff"]:
        return Response({"detail": "Not authorized"}, status=403)

    spend_map = compute_customer_spend()
    values = list(spend_map.values())

    clusters = [
        {
            "name": "High Value",
            "count": sum(1 for s in values if s >= 5000),
            "avg_spend": round(sum(s for s in values if s >= 5000) /
                               max(1, sum(1 for s in values if s >= 5000)), 2),
            "share": round(sum(1 for s in values if s >= 5000) * 100 / max(1, len(values)), 2),
        },
        {
            "name": "Regular",
            "count": sum(1 for s in values if 1000 <= s < 5000),
            "avg_spend": round(sum(s for s in values if 1000 <= s < 5000) /
                               max(1, sum(1 for s in values if 1000 <= s < 5000)), 2),
            "share": round(sum(1 for s in values if 1000 <= s < 5000) * 100 / max(1, len(values)), 2),
        },
        {
            "name": "At Risk",
            "count": sum(1 for s in values if s < 1000),
            "avg_spend": round(sum(s for s in values if s < 1000) /
                               max(1, sum(1 for s in values if s < 1000)), 2),
            "share": round(sum(1 for s in values if s < 1000) * 100 / max(1, len(values)), 2),
        }
    ]

    return Response({"clusters": clusters})
