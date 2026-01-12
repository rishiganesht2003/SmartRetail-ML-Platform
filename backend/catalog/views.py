import json
import datetime
from django.shortcuts import get_object_or_404
from django.db.models import Avg, Count
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.timezone import now
from decimal import Decimal

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from accounts.views import ensure_profile
from catalog.models import (
    Product,
    Wishlist,
    PriceAdjustment,
    InventoryItem,
)
from catalog.serializers import ProductSerializer


# =======================
# ADMIN PRODUCTS
# =======================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admin_products(request):
    if ensure_profile(request.user).role != "admin":
        return Response({"detail": "Admin only"}, status=403)

    if request.method == "GET":
        qs = Product.objects.all().order_by("-created_at")
        q = request.GET.get("q")
        category = request.GET.get("category")

        if q:
            qs = qs.filter(name__icontains=q) | qs.filter(description__icontains=q)

        if category:
            qs = qs.filter(category__icontains=category)

        qs = qs.annotate(
            rating=Avg("reviews__rating"),
            rating_count=Count("reviews"),
        )

        return Response(ProductSerializer(qs, many=True).data)

    p = Product.objects.create(
        name=request.data.get("name", ""),
        category=request.data.get("category", ""),
        description=request.data.get("description", ""),
        price=request.data.get("price", 0),
        base_price=request.data.get("price", 0),
        current_price=request.data.get("price", 0),
        stock=request.data.get("stock", 0),
        image=request.FILES.get("image"),
        is_active=True,
    )

    InventoryItem.objects.get_or_create(
        product=p, defaults={"stock": p.stock}
    )

    return Response(ProductSerializer(p).data, status=201)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def admin_product_detail(request, pk):
    if ensure_profile(request.user).role != "admin":
        return Response({"detail": "Admin only"}, status=403)

    p = get_object_or_404(Product, pk=pk)

    if request.method == "GET":
        return Response(ProductSerializer(p).data)

    if request.method == "PATCH":
        for field in [
            "name",
            "category",
            "description",
            "price",
            "stock",
            "is_active",
        ]:
            if field in request.data:
                if field == "price":
                    setattr(p, field, Decimal(request.data[field]))
                elif field == "stock":
                    setattr(p, field, int(request.data[field]))
                else:
                    setattr(p, field, request.data[field])

        if request.FILES.get("image"):
            p.image = request.FILES["image"]

        # 🔧 DO NOT override dynamic pricing unless admin explicitly changes price
        if "price" in request.data:
            p.current_price = p.price
            p.price_source = "manual"

        p.save()


        InventoryItem.objects.update_or_create(
            product=p, defaults={"stock": p.stock}
        )

        return Response({"detail": "Product updated"})

    p.delete()
    return Response(status=204)


# =======================
# CUSTOMER PRODUCTS
# =======================
@api_view(["GET"])
@permission_classes([AllowAny])
def customer_products(request):
    """Return all active products with current pricing, stock status and customer's segment if authenticated"""
    from django.db.models import Avg, Count
    from decimal import Decimal

    products = Product.objects.filter(is_active=True).prefetch_related('reviews')

    # determine requester segment (if any)
    user_segment = None
    try:
        if request.user and request.user.is_authenticated:
            user_segment = getattr(request.user.profile, "customer_segment", None)
    except Exception:
        user_segment = None

    data = []
    for p in products:
        current_price = p.current_price or p.base_price or p.price or Decimal("0")
        price_float = float(current_price) if current_price else 0.0
        if price_float <= 0:
            price_float = 99.99

        stock_value = int(p.stock) if p.stock is not None else 0

        try:
            rating_agg = p.reviews.aggregate(avg=Avg("rating"), count=Count("id"))
            rating = rating_agg.get('avg') or 0
            rating_count = rating_agg.get('count') or 0
        except Exception:
            rating = 0
            rating_count = 0

        data.append({
            "id": p.id,
            "name": p.name,
            "price": round(price_float, 2),
            "current_price": round(price_float, 2),
            "base_price": float(p.base_price or p.price or 0),
            "image": p.image.url if p.image else "",
            "category": p.category,
            "rating": rating or 0,
            "rating_count": rating_count,
            "stock": stock_value,
            "price_source": p.price_source or "manual",
            "customer_segment": user_segment,
        })

    return Response(data)


@api_view(["GET"])
@permission_classes([AllowAny])
def customer_product_detail(request, product_id):
    p = get_object_or_404(Product, id=product_id, is_active=True)
    return Response(ProductSerializer(p).data)


# =======================
# WISHLIST
# =======================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def customer_wishlist(request):
    if ensure_profile(request.user).role != "customer":
        return Response(status=403)

    items = Wishlist.objects.filter(user=request.user).select_related("product")
    return Response([
        {
            "id": w.product.id,
            "name": w.product.name,
            "price": float(w.product.price),
            "image": w.product.image.url if w.product.image else "",
            "category": w.product.category,
        }
        for w in items
    ])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_to_wishlist(request):
    product = get_object_or_404(Product, id=request.data.get("product_id"))
    Wishlist.objects.get_or_create(user=request.user, product=product)
    return Response({"success": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_from_wishlist(request):
    Wishlist.objects.filter(
        user=request.user, product_id=request.data.get("product_id")
    ).delete()
    return Response({"success": True})


# =======================
# PRICING (ML READY)
# =======================
def require_auth(request):
    return "HTTP_AUTHORIZATION" in request.META


def can_view_pricing(user):
    """Check if user can view/manage pricing"""
    try:
        return user.profile.role in ("admin", "staff")
    except Exception:
        return False


def dynamic_pricing_overview(request):
    if not require_auth(request):
        return JsonResponse({"detail": "Unauthorized"}, status=401)

    return JsonResponse({
        "total_products": Product.objects.count(),
        "price_changes_24h": PriceAdjustment.objects.filter(
            created_at__gte=now() - datetime.timedelta(days=1)
        ).count(),
        "revenue_increase": 1245,
        "acceptance_rate": 94.7,
        "avg_discount": 18.5,
    })


def pricing_products(request):
    if not require_auth(request):
        return JsonResponse({"detail": "Unauthorized"}, status=401)

    data = []
    for p in Product.objects.all():
        change = PriceAdjustment.objects.filter(product=p).order_by("-created_at").first()

        old_price = float(change.old_price) if change else float(p.price)
        new_price = float(change.new_price) if change else float(p.current_price)

        data.append({
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "image": p.image.url if p.image else None,
            "old_price": old_price,
            "new_price": new_price,
            "change": change.percentage_change if change else 0,
            "ai_reason": "Demand trend detected",
        })

    return JsonResponse(data, safe=False)


@csrf_exempt
def apply_manual_override(request):
    if not require_auth(request):
        return JsonResponse({"detail": "Unauthorized"}, status=401)

    body = json.loads(request.body)
    p = Product.objects.get(id=body["product_id"])
    new_price = float(body["new_price"])
    old_price = float(p.current_price or p.price)

    PriceAdjustment.objects.create(
        product=p,
        old_price=old_price,
        new_price=new_price,
        percentage_change=((new_price - old_price) / old_price) * 100,
    )

    p.price = new_price
    p.current_price = new_price
    p.price_source = "override"
    p.last_price_update = now()
    p.save()

    return JsonResponse({"success": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def apply_pricing_wrapper(request):
    """
    Wrapper endpoint that delegates to ML engine dynamic pricing.
    Located at /api/catalog/pricing/apply/
    """
    from ml_engine.services import apply_dynamic_pricing, ensure_config, mark_feature_cached
    
    if not can_view_pricing(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    cfg = ensure_config()
    
    # Get all active products or specific ones from request
    product_ids = request.data.get("product_ids", [])
    
    if product_ids:
        products = Product.objects.filter(id__in=product_ids, is_active=True)
    else:
        products = Product.objects.filter(is_active=True)

    applied = []
    
    for product in products:
        new_price, mode = apply_dynamic_pricing(product)
        applied.append({
            "id": product.id,
            "name": product.name,
            "old_price": float(product.base_price or product.price or 0),
            "new_price": float(new_price),
            "mode": mode,
        })

    mark_feature_cached(cfg, "dynamic_pricing")
    
    return Response({
        "success": True,
        "applied_count": len(applied),
        "applied": applied,
        "mode": "LIVE" if (cfg.global_enabled and cfg.features.get("dynamic_pricing", True)) else "CACHED",
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def customer_my_segment(request):
    """
    Return the logged-in customer's segment (quick endpoint).
    """
    try:
        seg = getattr(request.user.profile, "customer_segment", None)
    except Exception:
        seg = None

    # If not set, call segmentation recompute for this user via ml_engine view (no circular import)
    if not seg:
        # try recompute lightly
        from ml_engine.views import compute_segments as _compute_segments  # local import to avoid cycle
        try:
            _compute_segments()
            seg = getattr(request.user.profile, "customer_segment", None)
        except Exception:
            seg = None

    return Response({"segment": seg})
