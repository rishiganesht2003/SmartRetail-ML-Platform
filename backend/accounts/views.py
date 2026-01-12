from decimal import Decimal
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.db import transaction

from rest_framework import generics, serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from accounts.models import Profile, Wallet, WalletTransaction
from accounts.serializers import (
    RegisterSerializer,
    UserMiniSerializer,
    WalletTransactionSerializer,
)

# =========================
# HELPERS (UNCHANGED + EXTENDED)
# =========================
def ensure_profile(user):
    profile, _ = Profile.objects.get_or_create(
        user=user,
        defaults={
            "role": "customer",
            "full_name": user.get_full_name() or user.username,
            "is_active": True,
        },
    )
    return profile


def is_admin(user):
    return ensure_profile(user).role == "admin"


def is_staff(user):
    # 'staff' role removed — keep function for compatibility but always False
    return False


def is_customer(user):
    return ensure_profile(user).role == "customer"


def credit_wallet_refund(user, amount, description="Refund"):
    """
    ✅ REQUIRED by orders app (UNCHANGED)
    """
    wallet, _ = Wallet.objects.get_or_create(user=user)
    wallet.balance_inr += Decimal(amount)
    wallet.save()

    WalletTransaction.objects.create(
        wallet=wallet,
        txn_type="credit",
        source="refund",
        amount_inr=amount,
        description=description,
    )


# =========================
# AUTH (UNCHANGED)
# =========================
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class RoleBasedTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        user = authenticate(
            username=attrs.get("username"),
            password=attrs.get("password"),
        )
        if not user:
            raise serializers.ValidationError("Invalid credentials")

        data = super().validate(attrs)
        p = ensure_profile(user)

        data["role"] = p.role
        data["full_name"] = p.full_name
        return data


class RoleBasedTokenView(TokenObtainPairView):
    serializer_class = RoleBasedTokenSerializer


# =========================
# PROFILE (UNCHANGED)
# =========================
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def profile_view(request):
    user = request.user
    profile = ensure_profile(user)

    if request.method == "GET":
        return Response({
            "username": user.username,
            "email": user.email,
            "full_name": profile.full_name,
            "role": profile.role,
            "is_active": profile.is_active,
            "customer_segment": profile.customer_segment,
        })

    if "email" in request.data:
        user.email = request.data["email"]
        user.username = request.data["email"]
        user.save()

    if "full_name" in request.data:
        profile.full_name = request.data["full_name"]

    profile.save()
    return Response({"detail": "Profile updated"})


# =========================
# 🔹 NEW – COMMON USER INFO
# =========================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """
    Used by frontend globally (Admin / Staff / Customer)
    """
    ensure_profile(request.user)
    return Response(UserMiniSerializer(request.user).data)


# =========================
# ADMIN USERS (UNCHANGED)
# =========================
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admin_users(request):
    if not is_admin(request.user):
        return Response({"detail": "Admin only"}, status=403)

    if request.method == "GET":
        q = request.GET.get("q", "").strip()
        role = request.GET.get("role", "").strip()

        users = User.objects.all().order_by("id")

        if q:
            users = users.filter(
                username__icontains=q
            ) | users.filter(
                email__icontains=q
            ) | users.filter(
                profile__full_name__icontains=q
            )

        if role:
            users = users.filter(profile__role=role)

        return Response([
            {
                "id": u.id,
                "name": ensure_profile(u).full_name,
                "email": u.email,
                "role": ensure_profile(u).role,
                "is_active": u.is_active,
            }
            for u in users
        ])

    email = (request.data.get("email") or "").strip()
    role = request.data.get("role", "customer")
    name = request.data.get("name", "").strip()

    if not email:
        return Response({"detail": "Email required"}, status=400)

    if User.objects.filter(username=email).exists():
        return Response({"detail": "User already exists"}, status=400)

    password = "default123"

    with transaction.atomic():
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            is_active=True,
        )
        Profile.objects.create(
            user=user,
            role=role,
            full_name=name or email,
            is_active=True,
        )

    return Response({
        "detail": "User created",
        "username": user.username,
        "password": password,
    }, status=201)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def admin_user_detail(request, pk):
    if not is_admin(request.user):
        return Response({"detail": "Admin only"}, status=403)

    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "User not found"}, status=404)

    profile = ensure_profile(user)

    if request.method == "PATCH":
        if "name" in request.data:
            profile.full_name = request.data["name"]

        if "role" in request.data:
            profile.role = request.data["role"]

        if "is_active" in request.data:
            user.is_active = bool(request.data["is_active"])
            user.save()

        profile.save()
        return Response({"detail": "Updated"})

    user.delete()
    return Response(status=204)


# =========================
# WALLET (UNCHANGED + READ EXTENSION)
# =========================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def customer_wallet(request):
    wallet, _ = Wallet.objects.get_or_create(user=request.user)
    return Response({
        "balance_inr": wallet.balance_inr,
        "transactions": WalletTransactionSerializer(
            wallet.transactions.all(), many=True
        ).data,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def wallet_topup(request):
    amount = Decimal(str(request.data.get("amount", "0")))
    if amount <= 0:
        return Response({"detail": "Invalid amount"}, status=400)

    wallet, _ = Wallet.objects.get_or_create(user=request.user)
    wallet.balance_inr += amount
    wallet.save()

    WalletTransaction.objects.create(
        wallet=wallet,
        txn_type="credit",
        source="topup",
        amount_inr=amount,
        description="Manual top-up",
    )

    return Response({"balance_inr": wallet.balance_inr})
