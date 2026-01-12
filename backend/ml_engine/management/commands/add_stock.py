from django.core.management.base import BaseCommand
from catalog.models import Product


class Command(BaseCommand):
    help = 'Add stock to all products'

    def add_arguments(self, parser):
        parser.add_argument(
            '--amount',
            type=int,
            default=100,
            help='Amount of stock to add to each product (default: 100)'
        )

    def handle(self, *args, **options):
        amount = options['amount']
        
        self.stdout.write(f"📦 Adding {amount} stock to all products...\n")

        # Get all products
        products = Product.objects.all()
        total = products.count()

        if total == 0:
            self.stdout.write(self.style.WARNING("⚠️  No products found in database"))
            return

        # Update each product
        updated = 0
        for product in products:
            product.stock += amount
            product.save(update_fields=['stock'])
            updated += 1
            self.stdout.write(f"  ✓ {product.name}: {product.stock} units")

        # Show summary
        self.stdout.write("\n" + "="*60)
        self.stdout.write(self.style.SUCCESS(f"✅ Successfully added {amount} stock to {updated} products"))
        
        # Show statistics
        all_products = Product.objects.all()
        total_stock = sum(p.stock for p in all_products)
        avg_stock = total_stock / total if total > 0 else 0
        
        self.stdout.write(f"\n📊 STOCK STATISTICS:")
        self.stdout.write(f"   Total Products: {total}")
        self.stdout.write(f"   Total Stock: {total_stock} units")
        self.stdout.write(f"   Average Stock per Product: {avg_stock:.2f} units")
        self.stdout.write("="*60)

        self.stdout.write(self.style.SUCCESS("\n✨ Stock update completed!"))
