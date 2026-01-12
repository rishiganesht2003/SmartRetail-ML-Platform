from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import random

from catalog.models import Product, ProductReview, Wishlist
from orders.models import Order, OrderItem
from ml_engine.models import MLCache, SalesRecord
from reports.models import MonthlySalesCache
from core.models import CustomerBehavior


# ================================
# 🔧 CONFIG – YOU CAN TUNE THESE
# ================================
CUSTOMER_COUNT = 50
PRODUCT_COUNT = 40
ORDER_COUNT = 1000
MAX_ITEMS_PER_ORDER = 3
BEHAVIOR_EVENTS = 6000
REVIEW_COUNT = 500
MONTHS_OF_DATA = 8
# ================================


class Command(BaseCommand):
    help = "Seed large-volume demo data for SmartRetailProject"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("🚀 Starting large demo data seeding"))

        users = self.get_customers()
        products = self.get_products()

        self.create_bulk_orders(users, products)
        self.create_customer_behavior(users, products)
        self.create_reviews_and_wishlist(users, products)
        self.create_monthly_sales()
        self.create_ml_cache()

        self.stdout.write(self.style.SUCCESS("✅ Large demo data seeding completed"))

    # -----------------------------
    # GET EXISTING USERS
    # -----------------------------
    def get_customers(self):
        users = list(
            User.objects.filter(profile__role="customer")[:CUSTOMER_COUNT]
        )
        if not users:
            raise Exception("❌ No customers found. Seed users first.")
        return users

    # -----------------------------
    # GET EXISTING PRODUCTS
    # -----------------------------
    def get_products(self):
        products = list(Product.objects.filter(is_active=True)[:PRODUCT_COUNT])
        if not products:
            raise Exception("❌ No products found. Seed products first.")
        return products

    # -----------------------------
    # BULK ORDERS + ITEMS + SALES
    # -----------------------------
    def create_bulk_orders(self, users, products):
        import uuid
        import random
        from decimal import Decimal
        from django.utils import timezone
        from datetime import timedelta

        now = timezone.now()

        popular_products = products[: max(1, len(products) // 4)]

        for i in range(ORDER_COUNT):
            user = random.choice(users)
            order_date = now - timedelta(days=random.randint(0, 240))
            item_count = random.randint(1, MAX_ITEMS_PER_ORDER)
            selected_products = random.choices(products, k=item_count)

            total = Decimal("0.00")

            order = Order.objects.create(
                order_id=f"ORD-{uuid.uuid4().hex[:12].upper()}",
                customer=user,
                total_inr=Decimal("0.00"),
                status=random.choice(["paid", "shipped", "delivered"]),
                payment_method=random.choice(["UPI", "Card", "COD"]),
                address_snapshot={"city": "Bangalore"},
                items_snapshot=[],
                placed_at=order_date,
            )

            for p in selected_products:
                qty = random.randint(3, 6) if p in popular_products else random.randint(1, 2)
                price = p.current_price or p.base_price or p.price
                line_total = price * qty
                total += line_total

                OrderItem.objects.create(
                    order=order,
                    product=p,
                    quantity=qty,
                    price_inr=price,
                    price_at_purchase=price,
                    line_total=line_total,
                )

                p.stock = max(p.stock - qty, 0)
                p.save(update_fields=["stock"])

            order.total_inr = total
            order.save(update_fields=["total_inr"])

            if i % 100 == 0:
                self.stdout.write(f"  → Created {i} orders")

        self.stdout.write("✅ Bulk orders created successfully")

    # -----------------------------
    # CUSTOMER BEHAVIOR (ML SIGNAL)
    # -----------------------------
    def create_customer_behavior(self, users, products):
        actions = ["view", "click", "wishlist", "cart", "order"]

        events = [
            CustomerBehavior(
                user=random.choice(users),
                product=random.choice(products),
                action=random.choice(actions),
                metadata={"source": "seed"}
            )
            for _ in range(BEHAVIOR_EVENTS)
        ]

        CustomerBehavior.objects.bulk_create(events, batch_size=1000)

    # -----------------------------
    # REVIEWS + WISHLIST
    # -----------------------------
    def create_reviews_and_wishlist(self, users, products):
        for _ in range(REVIEW_COUNT):
            user = random.choice(users)
            product = random.choice(products)

            ProductReview.objects.get_or_create(
                user=user,
                product=product,
                defaults={
                    "rating": random.randint(3, 5),
                    "comment": "Good product"
                }
            )

            Wishlist.objects.get_or_create(
                user=user,
                product=random.choice(products)
            )

    # -----------------------------
    # MONTHLY SALES REPORT CACHE
    # -----------------------------
    def create_monthly_sales(self):
        for m in range(1, MONTHS_OF_DATA + 1):
            MonthlySalesCache.objects.update_or_create(
                year=2025,
                month=m,
                defaults={
                    "revenue": Decimal(
                        random.randint(800_000, 1_800_000)
                    ),
                    "orders": random.randint(80, 180),
                }
            )

    # -----------------------------
    # ML CACHE (FORECASTING)
    # -----------------------------
    def create_ml_cache(self):
        MLCache.objects.update_or_create(
            feature="sales_forecasting",
            defaults={
                "payload": {
                    "next_3_months": [1250000, 1380000, 1420000],
                    "metrics": {
                        "mae": 5200,
                        "rmse": 8300,
                        "r2": 0.89
                    }
                }
            }
        )
