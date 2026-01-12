import datetime
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from django.shortcuts import get_object_or_404

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.views import ensure_profile
from core.models import StoreSettings, Notification, CustomerAddress
from core.serializers import StoreSettingsSerializer, CustomerAddressSerializer
from orders.models import Order, OrderItem
from catalog.models import Product


# =========================
# HELPERS
# =========================
def ensure_staff_or_admin(user):
    return ensure_profile(user).role in ("staff", "admin")


def serialize_product(p):
    return {
        "id": p.id,
        "name": p.name,
        "category": p.category,
        "stock": p.stock,
        "price": float(p.price),
        "image": p.image.url if p.image else None,
    }


def serialize_order(order):
    return {
        "id": order.id,
        "order_id": order.order_id,
        "customer": order.customer.username if order.customer else "",
        "customer_name": getattr(order.customer.profile, "full_name", ""),
        "total_inr": float(order.total_inr),
        "status": order.status,
        "placed_at": order.placed_at,
    }


# =========================
# ADMIN SETTINGS
# =========================
class AdminSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if ensure_profile(request.user).role != "admin":
            return Response(status=403)

        settings = StoreSettings.objects.first()
        if not settings:
            settings = StoreSettings.objects.create(currency="INR")

        return Response(StoreSettingsSerializer(settings).data)

    def post(self, request):
        if ensure_profile(request.user).role != "admin":
            return Response(status=403)

        settings = StoreSettings.objects.first()
        serializer = StoreSettingsSerializer(
            settings, data=request.data, partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors, status=400)


# =========================
# CUSTOMER
# =========================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def customer_addresses(request):
    if ensure_profile(request.user).role != "customer":
        return Response(status=403)

    if request.method == "GET":
        qs = CustomerAddress.objects.filter(user=request.user)
        return Response(CustomerAddressSerializer(qs, many=True).data)

    serializer = CustomerAddressSerializer(data=request.data)
    if serializer.is_valid():
        if serializer.validated_data.get("is_default"):
            CustomerAddress.objects.filter(
                user=request.user, is_default=True
            ).update(is_default=False)

        addr = serializer.save(user=request.user)
        return Response(CustomerAddressSerializer(addr).data, status=201)

    return Response(serializer.errors, status=400)




@api_view(["GET"])
@permission_classes([IsAuthenticated])
def customer_notifications(request):
    if ensure_profile(request.user).role != "customer":
        return Response(status=403)

    qs = Notification.objects.filter(user=request.user)
    return Response([
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "is_new": n.is_new,
            "created_at": n.created_at,
        }
        for n in qs
    ])


# =========================
# STAFF
# =========================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def staff_overview(request):
    if not ensure_staff_or_admin(request.user):
        return Response(status=403)

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today_start + datetime.timedelta(days=1)

    todays_orders = Order.objects.filter(
        placed_at__gte=today_start,
        placed_at__lt=tomorrow,
    )

    revenue = todays_orders.aggregate(
        total=Sum("total_inr")
    )["total"] or Decimal("0")

    low_stock = Product.objects.filter(stock__lte=5)

    return Response({
        "today_orders_count": todays_orders.count(),
        "today_revenue": float(revenue),
        "total_products": Product.objects.count(),
        "low_stock": [serialize_product(p) for p in low_stock],
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def staff_list_orders(request):
    if not ensure_staff_or_admin(request.user):
        return Response(status=403)

    orders = Order.objects.all().order_by("-placed_at")[:20]
    return Response([serialize_order(o) for o in orders])


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def staff_order_detail(request, pk):
    if not ensure_staff_or_admin(request.user):
        return Response(status=403)

    order = get_object_or_404(Order, pk=pk)

    if request.method == "PATCH":
        order.status = request.data.get("status", order.status)
        order.save()

    items = OrderItem.objects.filter(order=order)

    return Response({
        **serialize_order(order),
        "items": [
            {
                "product": i.product.name,
                "quantity": i.quantity,
                "price_inr": float(i.price_inr),
                "line_total": float(i.line_total),
            }
            for i in items
        ],
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def staff_low_stock(request):
    if not ensure_staff_or_admin(request.user):
        return Response(status=403)

    products = Product.objects.filter(stock__lte=5)
    return Response([serialize_product(p) for p in products])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def staff_stock_list(request):
    if not ensure_staff_or_admin(request.user):
        return Response(status=403)

    products = Product.objects.all().order_by("name")
    return Response([serialize_product(p) for p in products])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def staff_stock_restock(request, product_id):
    if not ensure_staff_or_admin(request.user):
        return Response(status=403)

    try:
        qty = int(request.data.get("quantity", 0))
    except ValueError:
        return Response({"detail": "Invalid quantity"}, status=400)

    if qty <= 0:
        return Response({"detail": "Quantity must be positive"}, status=400)

    product = get_object_or_404(Product, pk=product_id)
    product.stock += qty
    product.save()

    return Response({"id": product.id, "stock": product.stock})


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def staff_stock_detail(request, product_id):
    if not ensure_staff_or_admin(request.user):
        return Response(status=403)

    product = get_object_or_404(Product, pk=product_id)

    if request.method == "PATCH":
        for field in ["name", "category", "price", "stock", "description"]:
            if field in request.data:
                setattr(product, field, request.data[field])
        product.save()

    return serialize_product(product)


# =========================
# ADMIN OVERVIEW
# =========================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_overview(request):
    if ensure_profile(request.user).role != "admin":
        return Response(status=403)

    orders = Order.objects.all()
    total_sales = orders.aggregate(
        total=Sum("total_inr")
    )["total"] or Decimal("0")

    total_orders = orders.count()
    avg_order_value = total_sales / total_orders if total_orders else Decimal("0")

    total_customers = orders.values("customer").distinct().count()
    low_stock_count = Product.objects.filter(stock__lte=5).count()

    now = timezone.now()
    labels, data = [], []

    for i in range(5, -1, -1):
        start = (now - datetime.timedelta(days=30 * i)).replace(day=1)
        end = (start + datetime.timedelta(days=32)).replace(day=1)

        month_total = Order.objects.filter(
            placed_at__gte=start,
            placed_at__lt=end,
        ).aggregate(total=Sum("total_inr"))["total"] or Decimal("0")

        labels.append(start.strftime("%b %Y"))
        data.append(float(month_total))

    return Response({
        "total_sales": float(total_sales),
        "forecast_next_month": float(total_sales * Decimal("1.05")),
        "total_customers": total_customers,
        "low_stock": low_stock_count,
        "avg_order_value": float(avg_order_value),
        "sales_series": {
            "labels": labels,
            "data": data,
        },
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def staff_notifications(request):
    if not ensure_staff_or_admin(request.user):
        return Response(status=403)

    notifications = []

    # Recent orders
    recent_orders = Order.objects.order_by("-placed_at")[:5]
    for o in recent_orders:
        notifications.append({
            "id": f"order-{o.id}",
            "type": "info",
            "title": "Order Update",
            "message": f"Order {o.order_id} is {o.status}",
            "created_at": o.placed_at,
            "is_new": True,
        })

    # Inventory warning
    low_stock_count = Product.objects.filter(stock__lte=5).count()
    if low_stock_count > 0:
        notifications.append({
            "id": "inventory-warning",
            "type": "warning",
            "title": "Low Stock Alert",
            "message": f"{low_stock_count} products are low on stock",
            "created_at": timezone.now(),
            "is_new": False,
        })

    return Response(notifications)
