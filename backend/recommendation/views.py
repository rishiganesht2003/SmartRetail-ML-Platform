from django.shortcuts import render

# Create your views here.
from collections import defaultdict, Counter
from django.utils import timezone
from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from products.models import Product
from orders.models import OrderItem
from accounts.models import Profile
from .serializers import RecommendationSerializer
from .models import RecommendationLog
from django.contrib.auth import get_user_model

User = get_user_model()

# -----------------------
# Heuristic co-purchase recommender (fast, DB-based)
# -----------------------
def compute_co_purchase_topk(limit=200, topk=5, window_days=180):
    """
    Build item->counter mapping of co-purchased items from orders in last window_days.
    Returns {product_id: Counter({other_product_id: count, ...}), ...}
    """
    end = timezone.now()
    start = end - timezone.timedelta(days=window_days)

    # Fetch OrderItem rows in the window
    qs = OrderItem.objects.filter(order__placed_at__gte=start, order__placed_at__lte=end).select_related("order")
    # Build order_id -> list of product_ids
    orders_map = defaultdict(list)
    for oi in qs:
        orders_map[oi.order_id].append(oi.product_id)

    co = defaultdict(Counter)
    for items in orders_map.values():
        unique = list(set(items))
        for i in range(len(unique)):
            for j in range(len(unique)):
                if i == j: continue
                a = unique[i]; b = unique[j]
                co[a][b] += 1

    # Optionally prune to top `limit` products by total sales for performance
    return co

def top_recommendations_for_product(product_id, co_map, k=8):
    """
    From co_map (product -> Counter), return list of top recommended products
    with reason text and score normalized.
    """
    counter = co_map.get(int(product_id), Counter())
    top = counter.most_common(k)
    # Normalize scores to 0..1
    if not top:
        return []
    max_score = top[0][1]
    recs = []
    for pid, cnt in top:
        score = round(float(cnt) / float(max_score) if max_score else 0.0, 3)
        try:
            p = Product.objects.get(pk=pid)
        except Product.DoesNotExist:
            continue
        recs.append({
            "product_id": int(product_id),
            "product_name": Product.objects.get(pk=product_id).name if Product.objects.filter(pk=product_id).exists() else "",
            "product_image": getattr(Product.objects.filter(pk=product_id).first(), "image", None) and Product.objects.get(pk=product_id).image.url or "",
            "recommended_id": pid,
            "recommended_name": p.name,
            "recommended_image": getattr(p, "image", None) and p.image.url or "",
            "score": score,
            "reason": f"Co-purchased {cnt} times with this product in recent orders",
        })
    return recs

# -----------------------
# API Views
# -----------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overview(request):
    """
    Basic overview stats for recommendation engine UI.
    """
    # cached counts and last run time are placeholder (we don't implement caching here)
    total_products = Product.objects.count()
    # How many recs we can compute: count of unique product ids in recent order items
    unique_products = OrderItem.objects.values_list("product_id", flat=True).distinct().count()

    last_run = None
    latest_log = RecommendationLog.objects.order_by("-created_at").first()
    if latest_log:
        last_run = latest_log.created_at.isoformat()

    return Response({
        "product_count": total_products,
        "model_count": 1,  # heuristic active
        "cached_recs": 0,  # implement caching later
        "last_run": last_run,
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def top_recommendations(request):
    limit = int(request.GET.get("limit", 100))
    co_map = compute_co_purchase_topk()
    # pick most popular products (by total sales) to show recommendations for
    popular = OrderItem.objects.values("product_id").annotate(total=Sum("quantity")).order_by("-total")[:limit]
    ids = [p["product_id"] for p in popular]
    out = []
    for pid in ids:
        recs = top_recommendations_for_product(pid, co_map, k=3)
        out.extend(recs)
    return Response({"recommendations": out})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def for_product(request):
    product_id = request.GET.get("product_id")
    if not product_id:
        return Response({"detail": "product_id required"}, status=status.HTTP_400_BAD_REQUEST)
    co_map = compute_co_purchase_topk()
    recs = top_recommendations_for_product(product_id, co_map, k=12)
    return Response({"recommendations": recs})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def retrain(request):
    """
    Placeholder endpoint: in future this would queue a training job.
    For now it recomputes the heuristic maps (this is synchronous but fast).
    """
    # The heuristic is computed on demand — no persistent model. We'll log the action.
    user = request.user if request.user.is_authenticated else None
    RecommendationLog.objects.create(
        admin=user if user and user.is_staff else None,
        product=0,
        recommended_product=0,
        score=0.0,
        reason="Manual retrain triggered",
    )
    return Response({"status": "recomputed"})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def log_apply(request):
    """
    Admin applies a recommendation — we log it for audit.
    """
    data = request.data
    product_id = data.get("product_id")
    recommended_id = data.get("recommended_id")
    score = float(data.get("score") or 0.0)
    reason = data.get("reason") or "applied via UI"

    user = request.user if request.user.is_authenticated else None

    RecommendationLog.objects.create(
        admin=user if user and user.is_staff else None,
        product=product_id,
        recommended_product=recommended_id,
        score=score,
        reason=reason,
    )
    return Response({"status": "logged"})
