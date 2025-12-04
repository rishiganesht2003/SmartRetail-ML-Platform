from django.db import models
from django.contrib.auth.models import User
from products.models import Product

class Order(models.Model):
    id = models.BigAutoField(primary_key=True)
    order_id = models.CharField(max_length=64, unique=True)
    total_inr = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20)
    placed_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    customer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    class Meta:
        db_table = "orders_order"

    def __str__(self):
        return self.order_id


class OrderItem(models.Model):
    id = models.BigAutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)
    price_inr = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "orders_orderitem"

    def __str__(self):
        return f"{self.order.order_id} - {self.product.name}"
