from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from .models import Product
from .serializers import ProductSerializer


# LIST PRODUCTS + SEARCH + FILTER
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def product_list(request):
    q = request.GET.get("q", "").lower().strip()
    category = request.GET.get("category", "").lower().strip()

    qs = Product.objects.all().order_by("-created_at")

    if q:
        qs = qs.filter(name__icontains=q) | qs.filter(description__icontains=q)

    if category:
        qs = qs.filter(category__icontains=category)

    serializer = ProductSerializer(qs, many=True)
    return Response(serializer.data)


# CREATE PRODUCT (multipart) – matches /manage/
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def product_create(request):
    data = request.POST

    p = Product.objects.create(
        name=data.get("name", "").strip(),
        category=data.get("category", "").strip(),
        description=data.get("description", "").strip(),
        price=float(data.get("price") or 0),
        stock=int(data.get("stock") or 0),
        image=request.FILES.get("image")
    )

    serializer = ProductSerializer(p)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


# GET / PATCH / DELETE PRODUCT
@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def product_detail(request, pk):
    p = get_object_or_404(Product, pk=pk)

    # GET
    if request.method == "GET":
        return Response(ProductSerializer(p).data)

    # PATCH
    if request.method == "PATCH":
        data = request.POST or request.data

        if "name" in data:
            p.name = data.get("name").strip()

        if "category" in data:
            p.category = data.get("category").strip()

        if "description" in data:
            p.description = data.get("description").strip()

        if "price" in data:
            try:
                p.price = float(data.get("price"))
            except:
                pass

        if "stock" in data:
            try:
                p.stock = int(data.get("stock"))
            except:
                pass

        if request.FILES.get("image"):
            p.image = request.FILES["image"]

        p.save()
        return Response(ProductSerializer(p).data)

    # DELETE
    if request.method == "DELETE":
        p.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
