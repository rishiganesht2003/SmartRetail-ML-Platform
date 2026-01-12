from django.core.management.base import BaseCommand
from orders.models import Coupon


class Command(BaseCommand):
    help = "Add sample coupons for different payment methods"

    def handle(self, *args, **options):
        coupons_data = [
            # All payment methods
            {
                "code": "SAVE100",
                "discount": 100,
                "methods": [],  # Empty = All methods
            },
            {
                "code": "FLAT50",
                "discount": 50,
                "methods": [],  # Empty = All methods
            },
            # UPI specific
            {
                "code": "UPISAVE200",
                "discount": 200,
                "methods": ["UPI"],
            },
            {
                "code": "GPAYSAVE150",
                "discount": 150,
                "methods": ["UPI"],
            },
            # Card specific
            {
                "code": "CARDDISCOUNT300",
                "discount": 300,
                "methods": ["Card"],
            },
            {
                "code": "CARDOFF200",
                "discount": 200,
                "methods": ["Card"],
            },
            # Wallet specific
            {
                "code": "WALLET100",
                "discount": 100,
                "methods": ["Wallet"],
            },
            {
                "code": "WALLETSAVE75",
                "discount": 75,
                "methods": ["Wallet"],
            },
            # COD specific
            {
                "code": "CODSAVE50",
                "discount": 50,
                "methods": ["COD"],
            },
        ]

        created_count = 0
        for coupon_data in coupons_data:
            coupon, created = Coupon.objects.get_or_create(
                code=coupon_data["code"],
                defaults={
                    "discount_amount": coupon_data["discount"],
                    "is_active": True,
                    "allowed_payment_methods": coupon_data["methods"],
                },
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✅ Created coupon: {coupon.code} - ₹{coupon.discount_amount}"
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f"⚠️  Coupon already exists: {coupon.code}"
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✅ Successfully created {created_count} new coupons!"
            )
        )
