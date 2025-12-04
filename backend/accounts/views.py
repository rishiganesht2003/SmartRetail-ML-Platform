# backend/accounts/views.py
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Profile
from .serializers import RegisterSerializer

# Helper: ensure Profile exists for a user
def ensure_profile(user):
    try:
        return user.profile
    except Exception:
        p = Profile.objects.create(
            user=user,
            role="customer",
            full_name=(user.get_full_name() or user.username)[:150],
            is_active=True
        )
        return p

# ---------- Register view (existing serializer used) ----------
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

# ---------- Custom Token (include role & full_name in token response) ----------
class RoleBasedTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")
        user = authenticate(username=username, password=password)
        if not user:
            raise serializers.ValidationError("Invalid credentials")

        data = super().validate(attrs)

        p = ensure_profile(user)
        data["role"] = p.role
        data["full_name"] = p.full_name
        # include refresh/access already provided by parent
        return data

class RoleBasedTokenView(TokenObtainPairView):
    serializer_class = RoleBasedTokenSerializer

# ---------- Protected test endpoint ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def protected(request):
    p = ensure_profile(request.user)
    return Response({
        "username": request.user.username,
        "role": p.role,
        "full_name": p.full_name,
    })

# ---------- Profile endpoints (GET, PATCH) ----------
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def my_profile(request):
    u = request.user
    p = ensure_profile(u)

    if request.method == "GET":
        return Response({
            "username": u.username,
            "email": u.email,
            "full_name": p.full_name,
            "role": p.role,
            "is_active": p.is_active,
        })

    # PATCH
    data = request.data or {}
    if "email" in data and data["email"]:
        u.email = data["email"].strip()
        u.username = u.email  # mirror username to email
        u.save()
    if "name" in data:
        p.full_name = data["name"] or p.full_name
    p.save()
    return Response({"detail": "Profile updated"}, status=status.HTTP_200_OK)

# ---------- Change password ----------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user
    old = request.data.get("old_password")
    new = request.data.get("new_password")

    if not old or not new:
        return Response({"detail": "Both old_password and new_password are required."}, status=status.HTTP_400_BAD_REQUEST)

    if not user.check_password(old):
        return Response({"detail": "Incorrect old password"}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new)
    user.save()
    return Response({"detail": "Password changed"}, status=status.HTTP_200_OK)

# ---------- Admin: list/create users (GET/POST) ----------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admin_users_list_create(request):
    req_profile = ensure_profile(request.user)
    if req_profile.role != "admin":
        return Response({"detail": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        q = request.GET.get("q", "").strip()
        role = request.GET.get("role", "").strip()

        users = User.objects.all().order_by("id")
        out = []
        for u in users:
            p = ensure_profile(u)
            if q:
                qlow = q.lower()
                if qlow not in (u.email or "").lower() and qlow not in (p.full_name or "").lower() and qlow not in (u.username or "").lower():
                    continue
            if role and p.role != role:
                continue
            out.append({
                "id": u.id,
                "name": p.full_name,
                "email": u.email,
                "role": p.role,
                "is_active": bool(p.is_active),
            })
        return Response(out)

    # POST - create user (admin creates user)
    data = request.data or {}
    email = (data.get("email") or "").strip()
    name = (data.get("name") or "").strip()
    role = data.get("role", "customer").strip()
    if not email:
        return Response({"detail": "Email required"}, status=status.HTTP_400_BAD_REQUEST)

    default_password = "default123"
    try:
        with transaction.atomic():
            username = email
            base = username
            suffix = 0
            while User.objects.filter(username=username).exists():
                suffix += 1
                username = f"{base.split('@')[0]}{suffix}"
            user = User.objects.create_user(username=username, email=email, password=default_password)
            Profile.objects.create(user=user, role=role if role in dict(Profile.ROLE_CHOICES) else "customer", full_name=name or username, is_active=True)
        return Response({"detail":"User created","id": user.id, "username": user.username, "password": default_password}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

# ---------- Admin: single user (GET/PATCH/DELETE) ----------
@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def admin_user_detail(request, pk):
    req_profile = ensure_profile(request.user)
    if req_profile.role != "admin":
        return Response({"detail":"Not authorized"}, status=status.HTTP_403_FORBIDDEN)
    try:
        u = User.objects.get(id=pk)
    except User.DoesNotExist:
        return Response({"detail":"User not found"}, status=status.HTTP_404_NOT_FOUND)
    p = ensure_profile(u)

    if request.method == "GET":
        return Response({"id":u.id,"name":p.full_name,"email":u.email,"role":p.role,"is_active":bool(p.is_active)})

    if request.method == "PATCH":
        data = request.data or {}
        changed = False
        if "email" in data and data["email"]:
            new_email = data["email"].strip()
            u.email = new_email
            u.username = new_email
            u.save()
            changed = True
        if "name" in data:
            p.full_name = data["name"] or p.full_name
            changed = True
        if "role" in data:
            new_role = data["role"]
            if new_role in dict(Profile.ROLE_CHOICES):
                p.role = new_role
                changed = True
        if "is_active" in data:
            p.is_active = bool(data["is_active"])
            changed = True
        if changed:
            p.save()
        return Response({"detail":"Updated"})

    # DELETE
    if request.method == "DELETE":
        u.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
