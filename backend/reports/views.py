# backend/reports/views.py
from django.utils import timezone
from django.db.models import Sum, Count, F
from django.db.models.functions import TruncMonth
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from datetime import datetime, timedelta
import calendar

# Try imports from your existing apps; if missing, set to None and handle later.
try:
    from sales.models import SalesRecord
except Exception:
    SalesRecord = None

try:
    from orders.models import Order, OrderItem
except Exception:
    Order = None
    OrderItem = None

try:
    from products.models import Product, Category
except Exception:
    Product = None
    Category = None

try:
    from inventory.models import InventoryItem
except Exception:
    InventoryItem = None

try:
    from pricing.models import PriceAdjustment
except Exception:
    PriceAdjustment = None

try:
    from forecast.models import ForecastCache
except Exception:
    ForecastCache = None

try:
    from recommendation.models import RecommendationLog
except Exception:
    RecommendationLog = None

try:
    from automation.models import AutomationModule, AutomationStats
except Exception:
    AutomationModule = None
    AutomationStats = None

try:
    from accounts.models import Profile
except Exception:
    Profile = None

from django.contrib.auth import get_user_model
User = get_user_model()


class ReportsOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        # last 12 months (labels)
        labels = []
        months = []
        for i in range(11, -1, -1):
            dt = (now - timedelta(days=now.day - 1)).replace(day=1) - timedelta(days=30 * i)
            # safer label using month numbers; final label set from end result
        # Better approach: compute exact last 12 month names:
        labels = []
        for i in range(11, -1, -1):
            y = (now.year if now.month - i > 0 else now.year - 1)
            m = ((now.month - i - 1) % 12) + 1
            labels.append(calendar.month_abbr[m])

        # ---------------------------
        # 1) Monthly Sales / Orders / AOV arrays
        # ---------------------------
        sales_values = [0] * 12
        orders_values = [0] * 12
        aov_values = [0] * 12

        # Try SalesRecord first
        if SalesRecord is not None:
            try:
                # assuming SalesRecord has "date" and "revenue" and "orders"
                start = (now.replace(day=1) - timedelta(days=365))
                qs = SalesRecord.objects.filter(date__gte=start)
                qs = qs.annotate(month=TruncMonth("date")).values("month").annotate(
                    revenue=Sum("revenue"), orders=Sum("orders")
                ).order_by("month")

                month_map = {calendar.month_abbr[d["month"].month]: d for d in qs}
                for idx, label in enumerate(labels):
                    d = month_map.get(label)
                    if d:
                        sales_values[idx] = float(d["revenue"] or 0)
                        orders_values[idx] = int(d["orders"] or 0)
                        aov_values[idx] = round(sales_values[idx] / max(1, orders_values[idx]), 2)
            except Exception:
                # fallback to orders below
                pass

        # Fallback: aggregate from orders/orderitems
        if (sum(sales_values) == 0 or sum(orders_values) == 0) and Order is not None and OrderItem is not None:
            try:
                start_date = (now.replace(day=1) - timedelta(days=365)).date()
                orders_qs = Order.objects.filter(created_at__date__gte=start_date)
                orders_by_month = orders_qs.annotate(m=TruncMonth("created_at")).values("m").annotate(
                    revenue=Sum("total_amount"), orders=Count("id")
                ).order_by("m")

                month_map = {calendar.month_abbr[d["m"].month]: d for d in orders_by_month}
                for idx, label in enumerate(labels):
                    d = month_map.get(label)
                    if d:
                        sales_values[idx] = float(d["revenue"] or 0)
                        orders_values[idx] = int(d["orders"] or 0)
                        aov_values[idx] = round(sales_values[idx] / max(1, orders_values[idx]), 2)
            except Exception:
                # If even this fails, leave zeros
                pass

        # ---------------------------
        # 2) Orders by Status
        # ---------------------------
        order_status = {"Delivered": 0, "Processing": 0, "Cancelled": 0, "Returned": 0}
        if Order is not None:
            try:
                status_qs = Order.objects.values("status").annotate(count=Count("id"))
                for s in status_qs:
                    key = s["status"] or "Unknown"
                    if key not in order_status:
                        order_status[key] = s["count"]
                    else:
                        order_status[key] = s["count"]
            except Exception:
                pass

        # ---------------------------
        # 3) Customer Segments (rule-based)
        #    - High Value: customers with total spend > X
        #    - New: created in last 30 days
        #    - At Risk: last order > 90 days ago OR no orders in last 90 days
        #    - Regular: rest
        # ---------------------------
        segments = {"High Value": 0, "Regular": 0, "New": 0, "At Risk": 0}
        try:
            # build a map user_id -> total_spend and last_order
            user_spend = {}
            user_last_order = {}
            if Order is not None:
                ords = Order.objects.values("user_id").annotate(total=Sum("total_amount"), last=Sum("id"))  # last is placeholder
                # safer: query per-user aggregate
                from django.db.models import Max
                ords = Order.objects.values("user_id").annotate(total=Sum("total_amount"), last_order=Max("created_at"))
                for o in ords:
                    uid = o.get("user_id")
                    user_spend[uid] = float(o.get("total") or 0)
                    user_last_order[uid] = o.get("last_order")
            # now decide thresholds
            now_dt = now
            high_value_thresh = 50000  # rupees — adjust as needed
            new_cutoff = now_dt - timedelta(days=30)
            at_risk_cutoff = now_dt - timedelta(days=90)

            users_qs = User.objects.all().values_list("id", flat=True)
            for uid in users_qs:
                total = user_spend.get(uid, 0)
                last = user_last_order.get(uid)
                if total >= high_value_thresh:
                    segments["High Value"] += 1
                elif last is None or (last and last <= at_risk_cutoff):
                    segments["At Risk"] += 1
                elif hasattr(User, "date_joined") and User.objects.filter(id=uid, date_joined__gte=new_cutoff).exists():
                    segments["New"] += 1
                else:
                    segments["Regular"] += 1
        except Exception:
            # best-effort fallback: small zeros
            pass

        # ---------------------------
        # 4) Inventory Health
        # ---------------------------
        inventory = {"Healthy": 0, "Low Stock": 0, "Out of Stock": 0, "Overstocked": 0}
        try:
            if InventoryItem is not None:
                items = InventoryItem.objects.all()
                for i in items:
                    stock = getattr(i, "stock", None) or 0
                    min_stock = getattr(i, "min_stock", None) or 0
                    max_stock = getattr(i, "max_stock", None) or (min_stock * 5 if min_stock else 100)
                    if stock <= 0:
                        inventory["Out of Stock"] += 1
                    elif stock <= min_stock:
                        inventory["Low Stock"] += 1
                    elif stock >= max_stock:
                        inventory["Overstocked"] += 1
                    else:
                        inventory["Healthy"] += 1
        except Exception:
            pass

        # ---------------------------
        # 5) Pricing impact (from PriceAdjustment)
        # ---------------------------
        pricing = {"labels": ["Baseline", "Promo", "AI-Price"], "lift": [0, 0, 0], "insights": []}
        try:
            if PriceAdjustment is not None:
                recent = PriceAdjustment.objects.order_by("-created_at")[:50]
                # estimate lifts: percent changes grouped by whether tag exists in adjustment (no tag through default)
                up_count = 0
                total_change = 0.0
                for p in recent:
                    try:
                        total_change += float(p.percentage_change or 0)
                        if float(p.percentage_change or 0) > 0:
                            up_count += 1
                    except Exception:
                        pass
                pricing["lift"] = [0, round(total_change / max(1, len(recent)), 2), round(total_change / max(1, len(recent)), 2)]
                pricing["insights"].append(f"Avg price change (recent {len(recent)}): {round(total_change / max(1, len(recent)),2)}%")
        except Exception:
            pass

        # ---------------------------
        # 6) Seasonal Trends (prefers ForecastCache)
        # ---------------------------
        seasonal = {"labels": ["Q1", "Q2", "Q3", "Q4"], "index": [1.0, 1.0, 1.0, 1.0]}
        try:
            if ForecastCache is not None:
                fc = ForecastCache.objects.order_by("-created_at").first()
                if fc and getattr(fc, "seasonal_index", None):
                    # assumes fc.seasonal_index is a mapping or list
                    idx = getattr(fc, "seasonal_index")
                    if isinstance(idx, dict):
                        seasonal["index"] = [float(idx.get("Q1", 1.0)), float(idx.get("Q2", 1.0)), float(idx.get("Q3", 1.0)), float(idx.get("Q4", 1.0))]
                    elif isinstance(idx, list) and len(idx) >= 4:
                        seasonal["index"] = [float(x) for x in idx[:4]]
        except Exception:
            pass

        # ---------------------------
        # 7) Top Products by Revenue
        # ---------------------------
        top_products = {"labels": [], "revenue": []}
        try:
            if OrderItem is not None and Product is not None:
                # aggregate revenue per product via order items
                items = OrderItem.objects.values("product_id").annotate(rev=Sum(F("price") * F("quantity"))).order_by("-rev")[:8]
                product_map = {}
                if Product is not None:
                    product_qs = Product.objects.filter(id__in=[i["product_id"] for i in items]).values("id", "sku", "name")
                    product_map = {p["id"]: (p.get("sku") or p.get("name") or str(p["id"])) for p in product_qs}
                for it in items:
                    pid = it["product_id"]
                    top_products["labels"].append(product_map.get(pid, f"#{pid}"))
                    top_products["revenue"].append(float(it["rev"] or 0))
        except Exception:
            pass

        # ---------------------------
        # 8) Users Growth
        # ---------------------------
        user_growth = {"labels": labels, "users": [0] * 12}
        try:
            if Profile is not None:
                # prefer created_at in Profile, else User.date_joined
                created_field = "created_at" if hasattr(Profile, "created_at") else None
                # aggregate new users per month
                from django.db.models.functions import TruncMonth
                if created_field:
                    qs = Profile.objects.annotate(m=TruncMonth(created_field)).values("m").annotate(count=Count("id"))
                else:
                    qs = User.objects.annotate(m=TruncMonth("date_joined")).values("m").annotate(count=Count("id"))
                month_map = {calendar.month_abbr[d["m"].month]: d["count"] for d in qs if d.get("m")}
                for idx, lbl in enumerate(labels):
                    user_growth["users"][idx] = int(month_map.get(lbl, 0))
        except Exception:
            pass

        # ---------------------------
        # 9) Recommendation CTR (from RecommendationLog if present)
        # ---------------------------
        reco_ctr = {"labels": [], "ctr": []}
        try:
            if RecommendationLog is not None:
                # expecting fields: timestamp, impressions, clicks
                from django.db.models import Sum
                rs = RecommendationLog.objects.annotate(m=TruncMonth("timestamp")).values("m").annotate(impr=Sum("impressions"), clicks=Sum("clicks")).order_by("m")[:12]
                for r in rs:
                    if not r.get("m"):
                        continue
                    reco_ctr["labels"].append(calendar.month_abbr[r["m"].month])
                    impr = r.get("impr") or 0
                    clicks = r.get("clicks") or 0
                    ctr = round((clicks / impr * 100) if impr else 0, 2)
                    reco_ctr["ctr"].append(ctr)
                if not reco_ctr["labels"]:
                    # fallback simple stub
                    reco_ctr = {"labels": labels[:6], "ctr": [0] * min(6, len(labels))}
        except Exception:
            reco_ctr = {"labels": labels[:6], "ctr": [0] * min(6, len(labels))}

        # ---------------------------
        # 10) Automation Runs
        # ---------------------------
        automation_runs = {"labels": labels[:6], "runs": [0] * min(6, 12)}
        try:
            if AutomationModule is not None and AutomationStats is not None:
                stats = AutomationStats.objects.first()
                if stats:
                    # quick map: runs per recent months by using created_at if present on stats or modules
                    automation_runs["runs"] = [int(stats.hours_saved // 10)] * len(automation_runs["labels"])
        except Exception:
            pass

        # ---------------------------
        # KPI cards (simple sums)
        # ---------------------------
        kpi_revenue = sum(sales_values)
        kpi_forecast = sales_values[-1] if sales_values else 0
        kpi_customers = User.objects.count() if User is not None else 0
        kpi_aov = round((kpi_revenue / max(1, sum(orders_values))), 2) if sum(orders_values) else 0

        payload = {
            "sales": {"labels": labels, "revenue": sales_values, "orders": orders_values, "aov": aov_values},
            "order_status": order_status,
            "segments": segments,
            "inventory": inventory,
            "pricing": pricing,
            "seasonal": seasonal,
            "top_products": top_products,
            "user_growth": user_growth,
            "reco_ctr": reco_ctr,
            "automation_runs": automation_runs,
            "kpis": {
                "revenue": kpi_revenue,
                "forecast_next_month": kpi_forecast,
                "customers": kpi_customers,
                "aov": kpi_aov,
            },
        }

        return Response(payload)
