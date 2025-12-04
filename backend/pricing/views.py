import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.timezone import now
from django.db.models import Avg, Sum, Count
from products.models import Product
from orders.models import OrderItem, Order
from .models import PriceAdjustment
import json

# --------------------------------------------
#  AUTH HELPER
# --------------------------------------------
def require_auth(request):
    if "HTTP_AUTHORIZATION" not in request.META:
        return None
    token = request.META["HTTP_AUTHORIZATION"].replace("Bearer ", "")
    return token if token else None


# --------------------------------------------------------------
# 1️⃣ DYNAMIC PRICING OVERVIEW (KPIs)
# --------------------------------------------------------------
def dynamic_pricing_overview(request):
    if not require_auth(request):
        return JsonResponse({"detail": "Unauthorized"}, status=401)

    total_products = Product.objects.count()
    price_changes = PriceAdjustment.objects.filter(
        created_at__gte=now() - datetime.timedelta(days=1)
    ).count()

    # Dummy values temporary (later replaced by ML)
    revenue_increase = 1245
    acceptance_rate = 94.7
    avg_discount = 18.5

    return JsonResponse({
        "total_products": total_products,
        "price_changes_24h": price_changes,
        "revenue_increase": revenue_increase,
        "acceptance_rate": acceptance_rate,
        "avg_discount": avg_discount,
    })
    

# --------------------------------------------------------------
# 2️⃣ PRICE CHANGES (Last 24 Hours)
# --------------------------------------------------------------
def price_changes_24h(request):
    if not require_auth(request):
        return JsonResponse({"detail": "Unauthorized"}, status=401)

    changes = PriceAdjustment.objects.filter(
        created_at__gte=now() - datetime.timedelta(hours=24)
    ).order_by("-created_at")

    data = []
    for c in changes:
        data.append({
            "product": c.product.name,
            "old_price": float(c.old_price),
            "new_price": float(c.new_price),
            "percentage_change": c.percentage_change,
            "timestamp": c.created_at,
        })

    return JsonResponse(data, safe=False)


# --------------------------------------------------------------
# 3️⃣ MANUAL OVERRIDE PRICE UPDATE
# --------------------------------------------------------------
@csrf_exempt
def apply_manual_override(request):
    if not require_auth(request):
        return JsonResponse({"detail": "Unauthorized"}, status=401)

    try:
        body = json.loads(request.body)
        product_id = body["product_id"]
        new_price = float(body["new_price"])

        product = Product.objects.get(id=product_id)
        old_price = float(product.price)

        percentage_change = ((new_price - old_price) / old_price) * 100

        # Save log
        PriceAdjustment.objects.create(
            product=product,
            old_price=old_price,
            new_price=new_price,
            percentage_change=percentage_change,
        )

        # Apply new price
        product.price = new_price
        product.save()

        return JsonResponse({"success": True, "new_price": new_price})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# --------------------------------------------------------------
# 4️⃣ DYNAMIC PRICING SETTINGS
# --------------------------------------------------------------
@csrf_exempt
def update_pricing_settings(request):
    if not require_auth(request):
        return JsonResponse({"detail": "Unauthorized"}, status=401)

    # For now store settings in file or cache
    # Later moves to DB

    return JsonResponse({"success": True})


def pricing_products(request):
    if not require_auth(request):
        return JsonResponse({"detail": "Unauthorized"}, status=401)

    products = Product.objects.all()   # FIXED — removed select_related()

    result = []

    for p in products:
        change = PriceAdjustment.objects.filter(product=p).order_by("-created_at").first()

        old_price = float(change.old_price) if change else float(p.price)
        new_price = float(change.new_price) if change else float(p.price)
        percentage_change = change.percentage_change if change else 0

        result.append({
            "id": p.id,
            "name": p.name,
            "category": p.category if hasattr(p, "category") else "General",
            "image": p.image.url if hasattr(p, "image") and p.image else None,
            "old_price": old_price,
            "new_price": new_price,
            "change": round(percentage_change, 2),
            "demand_score": 80,  # dummy
            "ai_reason": "High demand detected",  # dummy
        })

    return JsonResponse(result, safe=False)
