from django.core.management.base import BaseCommand
from catalog.models import Product


class Command(BaseCommand):
    help = 'Increase stock for all products'

    def add_arguments(self, parser):
        parser.add_argument(
            '--amount',
            type=int,
            default=100,
            help='Amount to increase stock by (default: 100)'
        )
        parser.add_argument(
            '--set-to',
            type=int,
            default=None,
            help='Set all products to this stock level (overrides --amount)'
        )

    def handle(self, *args, **options):
        amount = options['amount']
        set_to = options['set_to']

        total = Product.objects.count()
        self.stdout.write(f"📦 Found {total} products\n")

        if set_to is not None:
            # Set all to specific value
            Product.objects.all().update(stock=set_to)
            self.stdout.write(
                self.style.SUCCESS(f"✅ Set all products stock to {set_to}")
            )
        else:
            # Increase by amount
            updated = 0
            for product in Product.objects.all():
                product.stock += amount
                product.save(update_fields=['stock'])
                updated += 1

            self.stdout.write(
                self.style.SUCCESS(f"✅ Increased stock by {amount} for {updated} products")
            )

        # Show summary
        stats = Product.objects.values('stock').order_by('stock')
        min_stock = Product.objects.order_by('stock').first()
        max_stock = Product.objects.order_by('-stock').first()
        avg_stock = sum(p.stock for p in Product.objects.all()) / total if total > 0 else 0

        self.stdout.write("\n" + "="*50)
        self.stdout.write(f"📊 STOCK SUMMARY:")
        self.stdout.write(f"   Min Stock: {min_stock.stock if min_stock else 0}")
        self.stdout.write(f"   Max Stock: {max_stock.stock if max_stock else 0}")
        self.stdout.write(f"   Avg Stock: {avg_stock:.2f}")
        self.stdout.write("="*50 + "\n")

        self.stdout.write(self.style.SUCCESS("✨ Stock update completed!"))
