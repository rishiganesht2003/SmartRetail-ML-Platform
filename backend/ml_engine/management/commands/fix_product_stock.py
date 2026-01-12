from django.core.management.base import BaseCommand
from django.db.models import Q
from catalog.models import Product
from decimal import Decimal


class Command(BaseCommand):
    help = 'Fix products with missing or zero stock and prices'

    def handle(self, *args, **options):
        self.stdout.write("🔧 Starting product data fixes...\n")

        # ===== FIX 1: Update stock =====
        zero_stock = Product.objects.filter(Q(stock=0) | Q(stock__isnull=True))
        count1 = zero_stock.count()
        
        if count1 > 0:
            zero_stock.update(stock=50)
            self.stdout.write(
                self.style.SUCCESS(f"✅ Updated {count1} products with stock = 50")
            )
        else:
            self.stdout.write("ℹ️  All products have stock > 0")

        # ===== FIX 2: Update prices =====
        products = Product.objects.all()
        fixed = 0
        
        for p in products:
            should_save = False
            
            # Fix current_price
            if not p.current_price or p.current_price <= 0:
                p.current_price = p.base_price or p.price or Decimal("99.99")
                should_save = True
            
            # Fix base_price
            if not p.base_price or p.base_price <= 0:
                p.base_price = p.price or Decimal("99.99")
                should_save = True
            
            # Fix price
            if not p.price or p.price <= 0:
                p.price = p.current_price or Decimal("99.99")
                should_save = True
            
            # Set default price_source if missing
            if not p.price_source:
                p.price_source = "manual"
                should_save = True
            
            if should_save:
                p.save()
                fixed += 1
        
        if fixed > 0:
            self.stdout.write(
                self.style.SUCCESS(f"✅ Fixed prices for {fixed} products")
            )
        else:
            self.stdout.write("ℹ️  All products have valid prices")

        # ===== SUMMARY =====
        total = Product.objects.count()
        with_price = Product.objects.filter(price__gt=0).count()
        with_stock = Product.objects.filter(stock__gt=0).count()
        
        self.stdout.write("\n" + "="*50)
        self.stdout.write(f"📊 PRODUCT SUMMARY:")
        self.stdout.write(f"   Total Products: {total}")
        self.stdout.write(f"   Products with Price > 0: {with_price}")
        self.stdout.write(f"   Products with Stock > 0: {with_stock}")
        self.stdout.write("="*50)

        self.stdout.write(
            self.style.SUCCESS("\n✨ All fixes completed!")
        )
