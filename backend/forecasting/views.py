from django.shortcuts import render

# Create your views here.
import datetime
from django.db.models import Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from .models import SalesRecord, ForecastCache, AutomationSetting
from .serializers import ForecastCacheSerializer, AutomationSettingSerializer
from django.utils import timezone
from django.shortcuts import get_object_or_404
from decimal import Decimal
import statistics

# Utility: aggregate monthly totals (last N months)
def get_monthly_series(months=12):
    today = datetime.date.today()
    # Build months list descending
    months_list = []
    for i in range(months-1, -1, -1):
        dt = (today.replace(day=1) - datetime.timedelta(days=1)).replace(day=1)
        # safer: compute first day of month offset
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1
        months_list.append(datetime.date(year, month, 1))

    labels = []
    values = []
    for dt in months_list:
        start = dt
        # next month first day
        if dt.month == 12:
            nxt = datetime.date(dt.year + 1, 1, 1)
        else:
            nxt = datetime.date(dt.year, dt.month + 1, 1)
        total = SalesRecord.objects.filter(order_date__gte=start, order_date__lt=nxt).aggregate(
            s=Sum("total_amount")
        )["s"] or Decimal("0.00")
        labels.append(start.isoformat())
        values.append(float(total))
    return {"labels": labels, "values": values}


class SalesForecastingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """
        Return latest forecast payload for sales forecasting.
        If automation is enabled, return latest cache (or generate on-demand via generate endpoint).
        """
        # Check automation setting for this feature
        try:
            setting = AutomationSetting.objects.get(feature_name="sales_forecasting")
            automation_enabled = setting.enabled
            selected_model = setting.selected_model
        except AutomationSetting.DoesNotExist:
            automation_enabled = True
            selected_model = "prophet"

        # Prefer the latest ForecastCache
        cache = ForecastCache.objects.order_by("-updated_at").first()
        if not cache:
            # No cache yet: try to build a lightweight response using last 6 months of sales
            monthly = get_monthly_series(months=6)
            # fallback payload
            payload = {
                "forecast_next_month": 0,
                "confidence_score": 0.0,
                "time_range": "",
                "actual": {
                    "timestamps": monthly["labels"],
                    "values": monthly["values"],
                },
                "forecast": {
                    "timestamps": monthly["labels"],
                    "values": monthly["values"],
                },
                "model_metrics": {"mae": None, "rmse": None, "r2": None, "trained_at": None},
                "top_predictions": [],
                "insights": ["No forecast generated yet."],
                "automation": {"enabled": automation_enabled, "selected_model": selected_model},
            }
            return Response(payload, status=status.HTTP_200_OK)

        serializer = ForecastCacheSerializer(cache)
        data = serializer.data
        payload = {
            "forecast_next_month": data.get("forecast_next_month"),
            "confidence_score": data.get("confidence_score"),
            "time_range": data.get("time_range"),
            "actual": data.get("actual"),
            "forecast": data.get("forecast"),
            "model_metrics": data.get("model_metrics"),
            "top_predictions": data.get("top_predictions"),
            "insights": data.get("insights"),
            "automation": {"enabled": automation_enabled, "selected_model": selected_model},
        }
        return Response(payload, status=status.HTTP_200_OK)


class GenerateForecastView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """
        Trigger forecast generation. Body may contain:
          - model_name (prophet|arima|lstm etc)
          - horizon_months (int)
        For now we perform a simple moving-average forecast so system remains testable.
        """
        model_name = request.data.get("model_name", "prophet")
        horizon = int(request.data.get("horizon_months", 4))

        # Grab last 12 months of actuals (or fewer if not available)
        monthly = get_monthly_series(months=12)
        timestamps = monthly["labels"]
        actual_values = monthly["values"]

        # Simple forecasting placeholder: predict using last 3-month average + small trend
        def naive_forecast(values, n_steps):
            if not values:
                return [0.0] * n_steps
            window = values[-3:] if len(values) >= 3 else values
            avg = statistics.mean(window)
            # small linear trend estimate (difference between last two months)
            trend = 0.0
            if len(values) >= 2:
                trend = values[-1] - values[-2]
            preds = []
            last = values[-1] if values else avg
            for i in range(n_steps):
                # incremental trend applied
                val = last + avg * 0.02 + trend * (i+1) * 0.5
                preds.append(round(float(val), 2))
                last = val
            return preds

        forecast_values = naive_forecast(actual_values, horizon)
        # Build forecast timestamps (monthly): start from next month first day
        last_ts = datetime.date.fromisoformat(timestamps[-1]) if timestamps else datetime.date.today().replace(day=1)
        forecast_timestamps = []
        year = last_ts.year
        month = last_ts.month
        for i in range(1, horizon+1):
            m = month + i
            y = year + ((m-1)//12)
            mm = ((m-1) % 12) + 1
            forecast_timestamps.append(datetime.date(y, mm, 1).isoformat())

        # Compose top predictions (first 4 of horizon)
        top_preds = []
        for idx, ts in enumerate(forecast_timestamps[:4]):
            top_preds.append({"month": ts, "value": forecast_values[idx]})

        # Model metrics: naive placeholders
        mae = None
        rmse = None
        r2 = None
        if len(actual_values) >= 3:
            # quick MAE vs last 3 months (not real)
            diffs = []
            for a, p in zip(actual_values[-len(forecast_values):], forecast_values[:len(actual_values[-len(forecast_values):])]):
                diffs.append(abs(a - p))
            if diffs:
                mae = round(float(statistics.mean(diffs)), 2)

        metrics = {"mae": mae, "rmse": rmse, "r2": r2, "trained_at": timezone.now().isoformat()}

        forecast_next_month = Decimal(str(forecast_values[0])) if forecast_values else Decimal("0.0")
        confidence_score = round(0.8 + 0.1 * min(1.0, len(actual_values) / 12.0), 3)  # naive confidence

        insights = [
            "Auto-generated forecast (placeholder model). Replace with real ML model.",
        ]
        time_range = f"Next {horizon} months"

        # Persist cache
        cache = ForecastCache.objects.create(
            model_name=model_name,
            horizon_months=horizon,
            forecast_next_month=forecast_next_month,
            confidence_score=confidence_score,
            time_range=time_range,
            actual={"timestamps": timestamps, "values": actual_values},
            forecast={"timestamps": forecast_timestamps, "values": forecast_values},
            model_metrics=metrics,
            top_predictions=top_preds,
            insights=insights,
        )

        serializer = ForecastCacheSerializer(cache)
        payload = {
            "forecast_next_month": serializer.data.get("forecast_next_month"),
            "confidence_score": serializer.data.get("confidence_score"),
            "time_range": serializer.data.get("time_range"),
            "actual": serializer.data.get("actual"),
            "forecast": serializer.data.get("forecast"),
            "model_metrics": serializer.data.get("model_metrics"),
            "top_predictions": serializer.data.get("top_predictions"),
            "insights": serializer.data.get("insights"),
            "automation": {"enabled": True, "selected_model": model_name},
        }
        return Response(payload, status=status.HTTP_200_OK)
