from django.core.management.base import BaseCommand
from catalog.models import Product
from decimal import Decimal


class Command(BaseCommand):
    help = 'Create 10 sample products with stock and pricing'

    def handle(self, *args, **options):
        self.stdout.write("📦 Creating sample products...\n")

        products_data = [
            {
                "name": "Wireless Headphones",
                "category": "Electronics",
                "description": "High-quality wireless headphones with noise cancellation",
                "price": Decimal("2999.99"),
                "stock": 45,
            },
            {
                "name": "USB-C Cable",
                "category": "Accessories",
                "description": "Durable USB-C charging cable",
                "price": Decimal("499.99"),
                "stock": 150,
            },
            {
                "name": "Phone Case",
                "category": "Accessories",
                "description": "Protective phone case with shock absorption",
                "price": Decimal("799.99"),
                "stock": 87,
            },
            {
                "name": "Screen Protector",
                "category": "Accessories",
                "description": "Tempered glass screen protector",
                "price": Decimal("299.99"),
                "stock": 120,
            },
            {
                "name": "Power Bank",
                "category": "Electronics",
                "description": "20000mAh power bank with fast charging",
                "price": Decimal("1999.99"),
                "stock": 62,
            },
            {
                "name": "Laptop Stand",
                "category": "Office",
                "description": "Adjustable aluminum laptop stand",
                "price": Decimal("1499.99"),
                "stock": 35,
            },
            {
                "name": "Mechanical Keyboard",
                "category": "Electronics",
                "description": "RGB mechanical gaming keyboard",
                "price": Decimal("3499.99"),
                "stock": 28,
            },
            {
                "name": "Wireless Mouse",
                "category": "Electronics",
                "description": "Ergonomic wireless mouse",
                "price": Decimal("1299.99"),
                "stock": 56,
            },
            {
                "name": "HDMI Cable",
                "category": "Accessories",
                "description": "High-speed HDMI 2.1 cable",
                "price": Decimal("699.99"),
                "stock": 95,
            },
            {
                "name": "Monitor Light",
                "category": "Office",
                "description": "Auto-dimming monitor light bar",
                "price": Decimal("2499.99"),
                "stock": 41,
            },
        ]

        created = 0
        for data in products_data:
            # Check if product already exists
            if Product.objects.filter(name=data["name"]).exists():
                self.stdout.write(f"  ⏭️  {data['name']} already exists")
                continue

            product = Product.objects.create(
                name=data["name"],
                category=data["category"],
                description=data["description"],
                price=data["price"],
                base_price=data["price"],
                current_price=data["price"],
                stock=data["stock"],
                is_active=True,
                price_source="manual",
            )
            created += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f"  ✅ {product.name} - ₹{product.price} (Stock: {product.stock})"
                )
            )

        # Show summary
        self.stdout.write("\n" + "="*60)
        self.stdout.write(f"✨ Created {created} new products")
        
        total = Product.objects.count()
        total_stock = sum(p.stock for p in Product.objects.all())
        
        self.stdout.write(f"\n📊 SUMMARY:")
        self.stdout.write(f"   Total Products: {total}")
        self.stdout.write(f"   Total Stock: {total_stock} units")
        self.stdout.write("="*60)

        self.stdout.write(self.style.SUCCESS("\n✨ Products created successfully!"))
