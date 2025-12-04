from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User

from accounts.models import Profile
from .models import Order, OrderItem


def get_role(user):
    try:
        return user.profile.role
    except:
        return "customer"


# ========================================================
# ADMIN + STAFF → LIST ALL ORDERS
# ========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_list_orders(request):
    role = get_role(request.user)

    if role not in ["admin", "staff"]:
        return Response({"detail": "Not authorized"}, status=403)

    orders = Order.objects.all().order_by("-placed_at")

    out = []
    for o in orders:
        out.append({
            "id": o.id,
            "order_id": o.order_id,
            "customer": o.customer.username if o.customer else "Unknown",
            "customer_name": getattr(o.customer.profile, "full_name", "") if o.customer and hasattr(o.customer, "profile") else "",
            "total_inr": float(o.total_inr),
            "status": o.status,
            "placed_at": o.placed_at,
        })
    return Response(out)


# ========================================================
# ADMIN + STAFF (view-only) → ORDER DETAILS
# ========================================================
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def admin_order_detail(request, pk):
    role = get_role(request.user)

    try:
        order = Order.objects.get(id=pk)
    except:
        return Response({"detail": "Order not found"}, status=404)

    # Staff cannot update
    if role == "staff" and request.method == "PATCH":
        return Response({"detail": "Not authorized"}, status=403)

    # GET RESPONSE
    if request.method == "GET":
        items = OrderItem.objects.filter(order=order)

        return Response({
            "id": order.id,
            "order_id": order.order_id,
            "customer": order.customer.username if order.customer else "",
            "customer_name": getattr(order.customer.profile, "full_name", "") if order.customer and hasattr(order.customer, "profile") else "",
            "total_inr": float(order.total_inr),
            "status": order.status,
            "placed_at": order.placed_at,
            "updated_at": order.updated_at,
            "items": [
                {
                    "product": i.product.name,
                    "quantity": i.quantity,
                    "price_inr": float(i.price_inr),
                    "line_total": float(i.line_total)
                }
                for i in items
            ]
        })

    # PATCH (admin only)
    new_status = request.data.get("status")
    if new_status:
        order.status = new_status
        order.save()

    return Response({"detail": "Order updated"})
    

# ========================================================
# CUSTOMER → VIEW ONLY THEIR ORDERS
# ========================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def customer_my_orders(request):
    role = get_role(request.user)

    if role != "customer":
        return Response({"detail": "Not authorized"}, status=403)

    orders = Order.objects.filter(customer=request.user).order_by("-placed_at")

    out = []
    for o in orders:
        out.append({
            "order_id": o.order_id,
            "total_inr": float(o.total_inr),
            "status": o.status,
            "placed_at": o.placed_at,
        })

    return Response(out)
