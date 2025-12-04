from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from django.conf import settings
from products.models import Product
from .serializers import ProductFeedSerializer
from .models import CustomerBehavior

# PLACEHOLDER helpers - replace with real module calls when available
def get_recommendations_for_user(user_id, top_k=24):
    # Call recommendation app or ML model; placeholder selects top products
    # Example: from recommendation.utils import recommend_for_user
    # return recommend_for_user(user_id, k=top_k)
    return Product.objects.order_by("-id").values_list("id", flat=True)[:top_k]

def get_dynamic_price(product, user):
    # Call pricing app / ML. For now return product.price or adjusted
    try:
        return product.price  # decimal
    except:
        return 0

def adjust_for_season(price, product):
    # call seasonal adjustments; placeholder returns same price
    return price

def get_product_rating(product):
    # placeholder; if product has rating field return it
    return getattr(product, "rating", 0.0)

class PersonalizedFeedView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # 1) ask recommendation for this user (personalized)
        rec_ids = list(get_recommendations_for_user(user.id, top_k=24))

        # 2) fetch products preserving DB order for rec_ids
        products_qs = Product.objects.filter(id__in=rec_ids).distinct()

        # keep same order as rec_ids
        products_by_id = {p.id: p for p in products_qs}
        products_ordered = [products_by_id[i] for i in rec_ids if i in products_by_id]

        # 3) prepare response items
        items = []
        for p in products_ordered:
            price = get_dynamic_price(p, user)
            price = adjust_for_season(price, p)
            items.append({
                "id": p.id,
                "name": p.name,
                "category": p.category.name if getattr(p, "category", None) else "",
                "image": request.build_absolute_uri(p.image.url) if getattr(p, "image", None) else None,
                "price": price,
                "ai_price": price,
                "rating": float(get_product_rating(p)),
                "stock": getattr(p, "stock", 0),
                "reason": "Recommended"
            })

        serializer = ProductFeedSerializer(items, many=True)
        return Response({"products": serializer.data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def record_behavior(request):
    user = request.user
    product_id = request.data.get("product_id")
    action = request.data.get("action")
    metadata = request.data.get("metadata", {})
    if not action:
        return Response({"detail":"action required"}, status=status.HTTP_400_BAD_REQUEST)

    product = None
    if product_id:
        from products.models import Product
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            product = None

    CustomerBehavior.objects.create(user=user, product=product, action=action, metadata=metadata)
    return Response({"detail":"recorded"}, status=status.HTTP_201_CREATED)