import uuid
from decimal import Decimal

from django.shortcuts import get_object_or_404

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from catalog.models import Product
from orders.models import (
    Order,
    OrderItem,
    Coupon,
)
from accounts.views import ensure_profile, credit_wallet_refund


# ================================
# HELPERS
# ================================
def get_role(user):
    return ensure_profile(user).role


def ensure_admin(user):
    return get_role(user) == "admin"


def ensure_staff_or_admin(user):
    # 'staff' role removed — treat staff-only checks as admin-only
    return get_role(user) == "admin"


def get_effective_price(product: Product) -> Decimal:
    """
    HYBRID PRICING LOGIC:
    - If dynamic pricing applied → use current_price
    - Else fallback to base price (price)
    """
    if hasattr(product, "current_price") and product.current_price is not None:
        return Decimal(product.current_price)
    return Decimal(product.price)


# ================================
# ADMIN / STAFF – LIST ORDERS
# ================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_list_orders(request):
    if not ensure_staff_or_admin(request.user):
        return Response(status=403)

    orders = Order.objects.select_related("customer").all().order_by("-placed_at")

    return Response([
        {
            "order_id": o.order_id,
            "customer": o.customer.username if o.customer else "",
            "total_inr": float(o.total_inr),
            "status": o.status,
            "payment_method": o.payment_method,
            "placed_at": o.placed_at,
        }
        for o in orders
    ])


# ================================
# ADMIN / STAFF – ORDER DETAIL
# ================================
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def admin_order_detail(request, order_id):
    if not ensure_staff_or_admin(request.user):
        return Response(status=403)

    order = get_object_or_404(Order, order_id=order_id)

    # ---------- ADMIN STATUS UPDATE ----------
    if request.method == "PATCH":
        if not ensure_admin(request.user):
            return Response(status=403)

        new_status = request.data.get("status")
        if new_status:
            order.status = new_status
            order.save(update_fields=["status"])

    items = []
    for i in order.items.select_related("product").all():
        items.append({
            "id": i.id,
            "product": i.product.name,
            "quantity": i.quantity,
            "price_inr": float(i.price_at_purchase or i.price_inr),
            "line_total": float(i.line_total),
            "item_status": i.status,
        })

    return Response({
        "order_id": order.order_id,
        "status": order.status,
        "payment_status": "paid" if order.status not in ["failed"] else "failed",
        "payment_method": order.payment_method,
        "subtotal_inr": float(sum(i.line_total for i in order.items.all())),
        "discount_inr": float(order.discount_inr),
        "total_inr": float(order.total_inr),
        "customer": {
            "username": order.customer.username if order.customer else "",
            "email": order.customer.email if order.customer else "",
        },
        "placed_at": order.placed_at,
        "updated_at": order.updated_at,
        "address": order.address_snapshot,
        "items": items,
    })


# ================================
# CUSTOMER – CREATE ORDER
# ================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_customer_order(request):
    if get_role(request.user) != "customer":
        return Response(status=403)

    items = request.data.get("items", [])
    address = request.data.get("address")
    payment_method = request.data.get("payment_method", "COD")
    payment_meta = request.data.get("payment_meta", {})
    coupon_code = request.data.get("coupon")

    if not items or not address:
        return Response({"detail": "Invalid data"}, status=400)

    subtotal = Decimal("0.00")
    product_map = {}

    # ---------- CALCULATE SUBTOTAL ----------
    for item in items:
        product = get_object_or_404(Product, id=item["id"])
        qty = int(item.get("qty", 1))

        if qty <= 0:
            return Response({"detail": "Invalid quantity"}, status=400)

        if product.stock < qty:
            return Response(
                {"detail": f"Insufficient stock for {product.name}"},
                status=400,
            )

        unit_price = get_effective_price(product)
        product_map[product.id] = (product, unit_price, qty)
        subtotal += unit_price * qty

    # ---------- APPLY COUPON ----------
    discount = Decimal("0.00")
    applied_coupon = None

    if coupon_code:
        try:
            coupon = Coupon.objects.get(code=coupon_code, is_active=True)

            # payment method validation
            if (
                coupon.allowed_payment_methods
                and payment_method not in coupon.allowed_payment_methods
            ):
                return Response(
                    {"detail": "Coupon not valid for this payment method"},
                    status=400,
                )

            # If a percentage discount is present (non-zero), compute discount
            # from the order subtotal. Otherwise use the fixed amount.
            try:
                pct = Decimal(coupon.discount_percent or 0)
            except Exception:
                pct = Decimal("0")

            if pct and pct > 0:
                discount = (subtotal * pct / Decimal(100)).quantize(Decimal("0.01"))
            else:
                # Ensure fixed amount is a Decimal and rounded to 2 decimals
                try:
                    discount = Decimal(str(coupon.discount_amount or 0)).quantize(Decimal("0.01"))
                except Exception:
                    discount = Decimal("0.00")

            # Cap discount to subtotal
            if discount > subtotal:
                discount = subtotal

            applied_coupon = coupon.code

        except Coupon.DoesNotExist:
            return Response({"detail": "Invalid coupon"}, status=400)

    total = max(subtotal - discount, Decimal("0.00"))

    # ---------- CREATE ORDER ----------
    order = Order.objects.create(
        order_id=f"ORD-{uuid.uuid4().hex[:10].upper()}",
        customer=request.user,
        total_inr=total,
        status="paid" if payment_method != "COD" else "pending",
        payment_method=payment_method,
        payment_meta=payment_meta,
        coupon_code=applied_coupon,
        discount_inr=discount,
        address_snapshot=address,
        items_snapshot=items,
    )

    # ---------- CREATE ORDER ITEMS ----------
    for product_id, (product, unit_price, qty) in product_map.items():
        OrderItem.objects.create(
            order=order,
            product=product,
            quantity=qty,
            price_inr=unit_price,
            price_at_purchase=unit_price,
            line_total=unit_price * qty,
        )

        # stock decrement (safe)
        product.stock = max(product.stock - qty, 0)
        product.save(update_fields=["stock"])

    return Response(
        {
            "order_id": order.order_id,
            "subtotal": float(subtotal),
            "discount": float(discount),
            "total": float(total),
        },
        status=201,
    )


# ================================
# CUSTOMER – MY ORDERS
# ================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def customer_my_orders(request):
    if get_role(request.user) != "customer":
        return Response(status=403)

    orders = (
        Order.objects
        .filter(customer=request.user)
        .order_by("-placed_at")
    )

    return Response([
        {
            "order_id": o.order_id,
            "total": float(o.total_inr),
            "status": o.status,
            "placed_at": o.placed_at,
        }
        for o in orders
    ])


# ================================
# CUSTOMER – ORDER DETAIL
# ================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def customer_order_detail(request, order_id):
    if get_role(request.user) != "customer":
        return Response(status=403)

    order = get_object_or_404(
        Order,
        order_id=order_id,
        customer=request.user,
    )

    items = []
    for i in order.items.select_related("product").all():
        item_data = {
            "order_item_id": i.id,
            "product_id": i.product.id,
            "name": i.product.name,
            "qty": i.quantity,
            "price": float(i.price_at_purchase or i.price_inr),
            "status": i.status,
        }
        
        # Add product image if available
        if i.product.image:
            item_data["image"] = request.build_absolute_uri(i.product.image.url)
        else:
            item_data["image"] = None
        
        items.append(item_data)

    return Response({
        "order_id": order.order_id,
        "status": order.status,
        "subtotal": float(order.total_inr + order.discount_inr),
        "discount": float(order.discount_inr),
        "total": float(order.total_inr),
        "payment_method": order.payment_method,
        "items": items,
        "address": order.address_snapshot,
        "placed_at": order.placed_at,
    })


# ===================== CONTINUES IN PART 3 =====================
# ================================
# CUSTOMER – RETURN REQUEST
# ================================
# ADMIN – COUPON MANAGEMENT
# ================================
@api_view(["GET", "POST", "OPTIONS", "HEAD"])
@permission_classes([IsAuthenticated])
def admin_coupons(request):
    """
    Admin coupons endpoint:
    - GET: staff or admin can list coupons
    - POST: only admin can create coupons
    """
    # Allow staff or admin to view list
    if request.method == "GET":
        if not ensure_staff_or_admin(request.user):
            return Response(status=403)

        coupons = Coupon.objects.all().order_by("-id")
        return Response([
            {
                "id": c.id,
                "code": c.code,
                "discount_amount": float(c.discount_amount),
                "discount_percent": float(c.discount_percent or 0),
                "is_active": c.is_active,
                "allowed_payment_methods": c.allowed_payment_methods,
            }
            for c in coupons
        ])

    # CREATE COUPON (POST) — only admin
    if not ensure_admin(request.user):
        return Response(status=403)

    # Validate at least one of discount_amount or discount_percent is provided (can be zero but at least one present)
    da = request.data.get("discount_amount", 0)
    dp = request.data.get("discount_percent", 0)
    try:
        da_num = Decimal(str(da)) if da is not None else Decimal("0")
    except Exception:
        da_num = Decimal("0")
    try:
        dp_num = Decimal(str(dp)) if dp is not None else Decimal("0")
    except Exception:
        dp_num = Decimal("0")

    # Allow creation even if both are zero (some coupons may be future-enabled), but ensure numeric types
    Coupon.objects.create(
        code=request.data.get("code"),
        discount_amount=da_num,
        discount_percent=dp_num,
        is_active=request.data.get("is_active", True),
        allowed_payment_methods=request.data.get(
            "allowed_payment_methods", []
        ),
    )

    return Response({"success": True}, status=201)


@api_view(["GET", "PATCH", "DELETE", "OPTIONS", "HEAD"])
@permission_classes([IsAuthenticated])
def admin_coupon_detail(request, coupon_id):
    # GET: staff or admin can view coupon details
    if request.method == "GET":
        if not ensure_staff_or_admin(request.user):
            return Response(status=403)

        coupon = get_object_or_404(Coupon, id=coupon_id)
        return Response({
            "id": coupon.id,
            "code": coupon.code,
            "discount_amount": float(coupon.discount_amount),
            "discount_percent": float(coupon.discount_percent or 0),
            "is_active": coupon.is_active,
            "allowed_payment_methods": coupon.allowed_payment_methods,
        })

    # PATCH / DELETE: only admin allowed
    if not ensure_admin(request.user):
        return Response(status=403)

    coupon = get_object_or_404(Coupon, id=coupon_id)

    if request.method == "PATCH":
        coupon.code = request.data.get("code", coupon.code)
        # Update numeric fields carefully
        if "discount_amount" in request.data:
            try:
                coupon.discount_amount = Decimal(str(request.data.get("discount_amount", coupon.discount_amount)))
            except Exception:
                pass
        if "discount_percent" in request.data:
            try:
                coupon.discount_percent = Decimal(str(request.data.get("discount_percent", coupon.discount_percent)))
            except Exception:
                pass
        coupon.is_active = request.data.get(
            "is_active", coupon.is_active
        )
        coupon.allowed_payment_methods = request.data.get(
            "allowed_payment_methods",
            coupon.allowed_payment_methods,
        )
        coupon.save()

        return Response({"success": True})

    # DELETE
    coupon.delete()
    return Response({"success": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def customer_available_coupons(request):
    """
    Returns active coupons for customers
    """
    coupons = Coupon.objects.filter(is_active=True)

    data = []
    for c in coupons:
        data.append({
            "code": c.code,
            "discount_amount": float(c.discount_amount),
            "discount_percent": float(c.discount_percent or 0),
            "payment_methods": (
                c.allowed_payment_methods
                if c.allowed_payment_methods
                else ["ALL"]
            ),
        })

    return Response(data)


# ================================
# CUSTOMER – APPLY COUPON
# ================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def apply_coupon(request):
    """
    Apply a coupon code and return discount amount
    """
    coupon_code = request.data.get("code")
    payment_method = request.data.get("payment_method", "COD")

    if not coupon_code:
        return Response(
            {"detail": "Coupon code required"},
            status=400
        )

    try:
        coupon = Coupon.objects.get(code=coupon_code, is_active=True)
    except Coupon.DoesNotExist:
        return Response(
            {"detail": "Invalid or expired coupon"},
            status=400
        )

    # Check if coupon is valid for payment method
    if (
        coupon.allowed_payment_methods
        and payment_method not in coupon.allowed_payment_methods
    ):
        return Response(
            {"detail": "Coupon not valid for this payment method"},
            status=400
        )

    # Indicate which type should be used by default when applying coupon:
    apply_type = "amount"
    try:
        if Decimal(coupon.discount_percent or 0) and Decimal(coupon.discount_percent or 0) > 0:
            apply_type = "percent"
    except Exception:
        apply_type = "amount"

    return Response({
        "code": coupon.code,
        "discount_amount": float(coupon.discount_amount),
        "discount_percent": float(coupon.discount_percent or 0),
        "apply_type": apply_type,
    })

