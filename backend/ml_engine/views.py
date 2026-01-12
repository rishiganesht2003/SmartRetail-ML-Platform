import math
import io
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
import json
import urllib.request
from math import sin, pi
from decimal import Decimal
from catalog.models import PriceAdjustment
from django.contrib.auth.models import User
from django.db import models
from django.db.models import Sum, Count, Max, F
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django.shortcuts import get_object_or_404
import os
from django.conf import settings
from django.http import HttpResponse

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView

from accounts.models import Profile
from accounts.views import ensure_profile
from catalog.models import Product
from core.models import CustomerAddress, CustomerBehavior
from orders.models import Order, OrderItem

from ml_engine.models import (
    AutomationModule,
    AutomationStats,
    AutomationConfig,
    MLCache,
    RecommendationLog,
)
from ml_engine.serializers import ForecastCacheSerializer
from ml_engine.services import (
    ensure_config,
    DEFAULT_FEATURES,
    mark_feature_cached,
)
from ml_engine.powerbi_template import generate_powerbi_template

# =====================================================================
# COMMON HELPERS
# =====================================================================

def is_admin(user) -> bool:
    try:
        return user.profile.role == "admin"
    except Profile.DoesNotExist:
        return False


# =====================================================================
# AUTOMATION CENTER (GLOBAL + PER-FEATURE TOGGLES)
# =====================================================================

FEATURE_KEYS = list(DEFAULT_FEATURES.keys())


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def automation_status(request):
    """
    Returns:
    {
      global_enabled: bool,
      features: { feature_key: bool },
      last_cached: { feature_key: iso_datetime }
    }
    """
    cfg = ensure_config()

    return Response(
        {
            "global_enabled": cfg.global_enabled,
            "features": cfg.features or {},
            "last_cached": cfg.last_cached or {},
        }
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def automation_update(request):
    """
    Admin only.
    Update global toggle + per-feature toggles.
    """
    if not is_admin(request.user):
        return Response({"detail": "Admin only"}, status=403)

    cfg = ensure_config()
    data = request.data or {}

    if "global_enabled" in data:
        cfg.global_enabled = bool(data["global_enabled"])

    if "features" in data and isinstance(data["features"], dict):
        for key, val in data["features"].items():
            if key in FEATURE_KEYS:
                cfg.features[key] = bool(val)

    cfg.save(update_fields=["global_enabled", "features"])

    return Response(
        {
            "global_enabled": cfg.global_enabled,
            "features": cfg.features,
            "last_cached": cfg.last_cached or {},
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def automation_refresh_cache(request):
    """
    Admin only.
    Refresh cache timestamps for one feature or all.
    """
    if not is_admin(request.user):
        return Response({"detail": "Admin only"}, status=403)

    cfg = ensure_config()
    feature = (request.data or {}).get("feature")

    if feature:
        if feature not in FEATURE_KEYS:
            return Response(
                {"detail": f"Unknown feature '{feature}'"}, status=400
            )
        targets = [feature]
    else:
        targets = FEATURE_KEYS

    for key in targets:
        # 🔧 FIX: ensure automation center timestamps update correctly
        mark_feature_cached(cfg, key)

    return Response({"last_cached": cfg.last_cached})


def automation_meta(cfg, feature_key):
    feature_enabled = cfg.features.get(feature_key, True)
    if not cfg.global_enabled or not feature_enabled:
        mode = "OFF"
    else:
        mode = "ON"

    return {"feature": feature_key, "enabled": bool(feature_enabled), "mode": mode}


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def automation_toggle_module(request):
    """Toggle an AutomationModule's active state (admin only)."""
    if not is_admin(request.user):
        return Response({"detail": "Admin only"}, status=403)

    module_id = request.data.get("module_id")
    try:
        module = AutomationModule.objects.get(id=module_id)
    except AutomationModule.DoesNotExist:
        return Response({"detail": "Module not found"}, status=404)

    module.is_active = not module.is_active
    module.save(update_fields=["is_active"])

    return Response({"message": "Updated", "module_id": module.id, "active": module.is_active})


# NOTE: PBIX (Power BI Desktop) serving removed — prefer JSON or HTML reports.


@api_view(["GET"])
@permission_classes([AllowAny])
def generate_html_report(request):
    """Generate a self-contained HTML report with charts and tables.

    This produces an HTML file that embeds the combined dataset and renders
    charts with Chart.js so users can open the file in a browser to view
    interactive visuals without Power BI.
    """
    try:
        # Reuse the combined export logic in forecasting_overview (flat tables)
        # Forecasting series and overview
        series = build_monthly_series(12) or []
        forecast = simple_linear_forecast(series, 6) if series else simple_linear_forecast([], 6)
        forecasting_series = []
        labels = forecast.get("labels", [])
        actuals = forecast.get("actual", [])
        predicted = forecast.get("predicted", [])
        for i, lbl in enumerate(labels or []):
            forecasting_series.append({
                "label": str(lbl),
                "actual": (actuals[i] if i < len(actuals) else None),
                "predicted": (predicted[i] if i < len(predicted) else None),
            })

        forecasting_overview_rows = [
            {"metric": "Next Month Forecast", "value": float(forecast.get("forecast_next_month") or 0)},
            {"metric": "Confidence Score", "value": float(forecast.get("metrics", {}).get("confidence") or 0)},
        ]

        # Inventory
        inv_rows = compute_inventory_rows() or []
        inv_products = [
            {
                "id": int(r.get("id") or 0),
                "name": str(r.get("name") or ""),
                "category": r.get("category"),
                "stock": int(r.get("stock") or 0),
                "velocity": float(r.get("velocity") or 0.0),
                "days_left": (float(r.get("days_left")) if r.get("days_left") is not None else None),
                "risk": r.get("risk") or "",
                "reorder_qty": int(r.get("reorder_qty") or 0),
                "price": float(r.get("price") or 0.0),
                "base_price": float(r.get("base_price") or 0.0),
            }
            for r in inv_rows
        ]
        inv_overview = compute_inventory_overview(inv_rows) or {}
        inv_overview_rows = [{"metric": k, "value": inv_overview.get(k)} for k in ["total_products", "high_risk", "medium_risk", "low_risk", "total_stock", "total_reorder_needed", "avg_days_supply"]]

        # Pricing
        pricing_products = compute_pricing_products() or []
        pricing_products_rows = [
            {
                "id": int(p.get("id") or 0),
                "name": str(p.get("name") or ""),
                "category": p.get("category"),
                "old_price": float(p.get("old_price") or 0.0),
                "new_price": float(p.get("new_price") or 0.0),
                "change_percent": float(p.get("change") or 0.0),
                "ai_reason": p.get("ai_reason") or "",
            }
            for p in pricing_products
        ]
        pricing_overview_rows = [{"metric": "Optimized Prices", "value": len(pricing_products_rows)}, {"metric": "Acceptance Rate", "value": 100.0}]

        # Recommendations
        reco_overview = {
            "active_products": Product.objects.filter(is_active=True).count(),
            "total_interactions": CustomerBehavior.objects.count(),
            "total_orders": Order.objects.count(),
        }
        limit = 50
        now = timezone.now()
        since = now - timedelta(days=60)
        sales = OrderItem.objects.filter(
            order__placed_at__gte=since,
            order__status__in=["paid", "shipped", "delivered"],
        )
        units_sold = defaultdict(int)
        for s in sales:
            units_sold[s.product_id] += s.quantity
        max_units = max(units_sold.values()) if units_sold else 1

        products = compute_recommendations(product_id=None, limit=limit, segment=None)
        reco_products_rows = []
        for p in products:
            sold = units_sold.get(p.id, 0)
            demand_score = min(100, int((sold / max_units) * 100) if max_units > 0 else 0)
            if demand_score >= 75:
                reason = "High demand"
            elif demand_score >= 40:
                reason = "Moderate demand"
            else:
                reason = "Low demand"

            reco_products_rows.append({
                "id": int(p.id or 0),
                "name": p.name or "",
                "price": float(p.current_price or p.base_price or p.price or 0),
                "category": p.category,
                "stock": int(p.stock) if p.stock else 0,
                "demand_score": demand_score,
                "reason": reason,
            })

        reco_overview_rows = [{"metric": k, "value": reco_overview.get(k)} for k in ["active_products", "total_interactions", "total_orders"]]

        # Segmentation
        seg_rows = compute_segments() or []
        seg_customers_rows = [
            {
                "user_id": int(s.get("user_id") or 0),
                "name": s.get("name") or "",
                "email": s.get("email") or "",
                "orders": int(s.get("orders") or 0),
                "total_spent": float(s.get("total_spent") or 0.0),
                "recency_days": (int(s.get("recency_days")) if s.get("recency_days") is not None else None),
                "segment": s.get("segment") or "",
            }
            for s in seg_rows
        ]
        seg_overview = compute_segmentation_overview(seg_rows) or {}
        seg_overview_rows = [{"metric": k, "value": seg_overview.get(k)} for k in ["total_customers"]]

        # Seasonal
        history = build_daily_history(days=365) or []
        seasonal_forecast = simple_seasonal_forecast(history, horizon_days=90) if history else []
        seasonal_rows = [
            {"ds": s.get("ds"), "yhat": float(s.get("yhat") or 0.0), "yhat_lower": float(s.get("yhat_lower") or 0.0), "yhat_upper": float(s.get("yhat_upper") or 0.0)}
            for s in seasonal_forecast
        ]
        seasonal_overview = compute_seasonal_overview(history) or {}
        seasonal_overview_rows = [{"metric": k, "value": seasonal_overview.get(k)} for k in ["has_model", "total_products", "last_trained_at"]]

        combined = {
            "forecasting_overview": forecasting_overview_rows or [],
            "forecasting_series": forecasting_series or [],
            "inventory_overview": inv_overview_rows or [],
            "inventory_products": inv_products or [],
            "pricing_overview": pricing_overview_rows or [],
            "pricing_products": pricing_products_rows or [],
            "recommendations_overview": reco_overview_rows or [],
            "recommendations_products": reco_products_rows or [],
            "segmentation_overview": seg_overview_rows or [],
            "segmentation_customers": seg_customers_rows or [],
            "seasonal_overview": seasonal_overview_rows or [],
            "seasonal_daily_forecast": seasonal_rows or [],
        }

        # Build simple HTML page embedding the data and Chart.js
        generated_iso = datetime.utcnow().isoformat() + "Z"
        # Build frontend-style payload matching admin UI / Excel export
        frontend_payload = {
            "forecasting": {
                "forecast_next_month": forecast.get("forecast_next_month"),
                "confidence_score": forecast.get("metrics", {}).get("confidence"),
                "series": {"labels": labels, "predicted": predicted, "actual": actuals},
            },
            "inventory": {
                **(inv_overview or {}),
                "products": inv_products or [],
            },
            "pricing": {
                "optimized_prices": len(pricing_products_rows),
                "acceptance_rate": next((r.get("value") for r in pricing_overview_rows if r.get("metric") == "Acceptance Rate"), None),
                "revenue_gain": None,
                "products": pricing_products_rows or [],
            },
            "recommendations": {
                **(reco_overview or {}),
                "products": reco_products_rows or [],
            },
            "segmentation": {
                "segments": (lambda rows: (lambda m: m)(__import__('collections').Counter([r.get('segment') or 'UNKNOWN' for r in (rows or [])])))(seg_customers_rows),
                "customers": seg_customers_rows or [],
            },
            "seasonal": {
                **(seasonal_overview or {}),
                "daily_forecast": seasonal_rows or [],
            },
        }

        data_json = json.dumps(combined)

        # Try to inline Chart.js for offline use; fall back to CDN if fetch fails
        chart_js_code = None
        try:
            cdn = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"
            with urllib.request.urlopen(cdn, timeout=5) as r:
                chart_js_code = r.read().decode("utf-8")
        except Exception:
            chart_js_code = None

        # Build standalone HTML with inline CSS and JS. All data embedded in DATA variable.
        # The CSS implements a dark, enterprise dashboard theme with sticky headers and zebra tables.
        inline_chart_js = f"<script>{chart_js_code}</script>" if chart_js_code else "<script src=\"https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js\"></script>"

        html = (
            "<!doctype html>\n"
            "<html lang=\"en\">\n"
            "<head>\n"
            "  <meta charset=\"utf-8\">\n"
            "  <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
            "  <title>SmartRetail Executive Report</title>\n"
            "  <style>\n"
            "    :root{--bg:#0b1220;--card:#0f1724;--muted:#9ca3af;--accent:#6d28d9;--surface:#0b1220;--card-2:#091123;--glass:rgba(255,255,255,0.03);}\n"
            "    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:#e6eef8;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.4}header{padding:20px 28px;border-bottom:1px solid rgba(255,255,255,0.03);position:sticky;top:0;background:linear-gradient(180deg,rgba(11,18,32,0.9),rgba(11,18,32,0.8));backdrop-filter:blur(4px);z-index:20}h1{margin:0;font-size:20px;letter-spacing:-0.2px}h2{margin:0 0 8px 0}main{padding:20px 28px;max-width:1300px;margin:0 auto}\.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}\.col-6{grid-column:span 6}\.col-4{grid-column:span 4}\.col-12{grid-column:span 12}\.panel{background:linear-gradient(180deg,var(--card),var(--card-2));padding:16px;border-radius:12px;box-shadow:0 6px 18px rgba(2,6,23,0.6);border:1px solid rgba(255,255,255,0.03);}\n"
            "    canvas{width:100% !important;height:260px !important;border-radius:8px;background:transparent}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}th,td{padding:8px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.03)}th{position:sticky;top:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(6px);z-index:5}tbody tr:nth-child(odd){background:linear-gradient(90deg,rgba(255,255,255,0.008),transparent)}tbody tr:hover{background:rgba(255,255,255,0.02)}.section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}pre{background:var(--glass);padding:12px;border-radius:8px;color:var(--muted);overflow:auto}@media (max-width:900px){.grid{grid-template-columns:repeat(1,1fr)}canvas{height:220px !important}}@media print{body{color:#000;background:#fff} .panel{box-shadow:none;border:1px solid #ddd}th{position:static}}</style>\n"
            "</head>\n"
            "<body>\n"
            "  <header>\n"
            "    <h1>SmartRetail — Executive Report</h1>\n"
            "  </header>\n"
            "  <main>\n"
            "    " + inline_chart_js + "\n"
            "    <script>const DATA = " + data_json + ";</script>\n"
            "    <section class=\"grid\">\n"
            "      <div class=\"col-12 panel\">\n"
            "        <div class=\"section-header\"><h2>Forecasting</h2><div style=\"font-size:12px;color:var(--muted)\">Forecasting uses historical revenue series and linear projection</div></div>\n"
            "        <canvas id=\"forecastChart\"></canvas>\n"
            "        <div id=\"forecastKV\"></div>\n"
            "        <div id=\"forecastTable\"></div>\n"
            "      </div>\n"
            "      <div class=\"col-6 panel\">\n"
            "        <div class=\"section-header\"><h2>Inventory</h2><div style=\"font-size:12px;color:var(--muted)\">Full inventory table with stock, velocity and reorder</div></div>\n"
            "        <canvas id=\"inventoryChart\"></canvas>\n"
            "        <div id=\"inventoryKV\"></div>\n"
            "        <div id=\"inventoryRows\"></div>\n"
            "      </div>\n"
            "      <div class=\"col-6 panel\">\n"
            "        <div class=\"section-header\"><h2>Pricing</h2><div style=\"font-size:12px;color:var(--muted)\">Pricing suggestions and change percentages</div></div>\n"
            "        <canvas id=\"pricingChart\"></canvas>\n"
            "        <div id=\"pricingKV\"></div>\n"
            "        <div id=\"pricingTable\"></div>\n"
            "      </div>\n"
            "      <div class=\"col-6 panel\">\n"
            "        <div class=\"section-header\"><h2>Recommendations</h2><div style=\"font-size:12px;color:var(--muted)\">Product recommendations and demand signals</div></div>\n"
            "        <canvas id=\"recoChart\"></canvas>\n"
            "        <div id=\"recoKV\"></div>\n"
            "        <div id=\"recoTable\"></div>\n"
            "      </div>\n"
            "      <div class=\"col-6 panel\">\n"
            "        <div class=\"section-header\"><h2>Customer Segmentation</h2><div style=\"font-size:12px;color:var(--muted)\">All customers with assigned segments</div></div>\n"
            "        <canvas id=\"segChart\"></canvas>\n"
            "        <div id=\"segTable\"></div>\n"
            "      </div>\n"
            "      <div class=\"col-12 panel\">\n"
            "        <div class=\"section-header\"><h2>Seasonal Forecasts</h2><div style=\"font-size:12px;color:var(--muted)\">Daily seasonal forecast and intervals</div></div>\n"
            "        <canvas id=\"seasonalChart\"></canvas>\n"
            "        <div id=\"seasonalTable\"></div>\n"
            "      </div>\n"
            "      <div class=\"col-12 panel\">\n"
            "        <div class=\"section-header\"><h2>Raw Combined Data</h2><div style=\"font-size:12px;color:var(--muted)\">Complete JSON used for charts and tables</div></div>\n"
            "        <pre id=\"rawPre\" style=\"max-height:540px;overflow:auto;\"></pre>\n"
            "      </div>\n"
            "    </section>\n"
            "    <script>\n"
            "      // Utility: render object array as HTML table into element id\n"
            "      function renderObjectTable(elId, rows){\n"
            "        try{const el=document.getElementById(elId); if(!el) return; if(!Array.isArray(rows)){el.innerHTML='<p style=\"color:var(--muted)\">No data</p>';return} if(rows.length===0){el.innerHTML='<p style=\"color:var(--muted)\">No rows</p>';return} const cols = Array.from(rows.reduce((s,r)=>{Object.keys(r||{}).forEach(k=>s.add(k));return s}, new Set())); let html='<div style=\"overflow:auto;border-radius:8px;margin-top:10px\"><table><thead><tr>'+cols.map(c=>`<th>${c}</th>`).join('')+'</tr></thead><tbody>'; for(const r of rows){ html+='<tr>'+cols.map(c=>`<td>${(r&&r[c]!==undefined && r[c]!==null)?String(r[c]):''}</td>`).join('')+'</tr>' } html+='</tbody></table></div>'; el.innerHTML=html}catch(e){console.warn('table render',e)} }\n"
            "      // Utility: render metric/value pairs\n"
            "      function renderKVTable(elId, rows){ try{ const el=document.getElementById(elId); if(!el) return; if(!Array.isArray(rows)){el.innerHTML='';return} let html='<div style=\"overflow:auto;border-radius:8px;margin-top:10px\"><table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>'; for(const r of rows){ html+='<tr><td>'+ (r.metric||'') +'</td><td>'+ (r.value===null||r.value===undefined?'':String(r.value)) +'</td></tr>' } html+='</tbody></table></div>'; el.innerHTML=html }catch(e){console.warn('kv render',e)} }\n"
            "      // Charts and tables population\n"
            "      try{\n"
            "        // Forecasting\n"
            "        const fseries = DATA.forecasting_series||[]; const fOverview = DATA.forecasting_overview||[];\n"
            "        renderKVTable('forecastKV', fOverview); renderObjectTable('forecastTable', fseries);\n"
            "        try{ const flabels=fseries.map(r=>r.label); const fpred=fseries.map(r=>r.predicted); const fact=fseries.map(r=>r.actual); const ctx=document.getElementById('forecastChart').getContext('2d'); new Chart(ctx,{type:'line',data:{labels:flabels,datasets:[{label:'Actual Sales (₹)',data:fact,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.12)',fill:true,tension:0.35,borderWidth:2,pointRadius:4,pointBackgroundColor:'#3b82f6'},{label:'Predicted Sales (₹)',data:fpred,borderColor:'#7c3aed',backgroundColor:'rgba(124,58,237,0.12)',fill:true,tension:0.35,borderWidth:2,pointRadius:4,pointBackgroundColor:'#7c3aed'}]},options:{maintainAspectRatio:false,responsive:true,plugins:{legend:{labels:{color:'#cbd5e1'},position:'top'}},scales:{x:{ticks:{color:'#9fb0c8'}},y:{ticks:{color:'#9fb0c8'},beginAtZero:false}}}}); }catch(e){console.warn(e)}\n"

            "        // Inventory\n"
            "        const invProducts = DATA.inventory_products||[]; const invOverview = DATA.inventory_overview||[]; renderObjectTable('inventoryRows', invProducts); renderKVTable('inventoryKV', invOverview); try{ const ilabels=invOverview.map(r=>r.metric); const ivals=invOverview.map(r=>r.value); const ctxI=document.getElementById('inventoryChart').getContext('2d'); new Chart(ctxI,{type:'bar',data:{labels:ilabels,datasets:[{label:'Value',data:ivals,backgroundColor:'#ef4444'}]},options:{maintainAspectRatio:false,responsive:true}}); }catch(e){}\n"
            "        // Pricing\n"
            "        const pProducts = DATA.pricing_products||[]; const pOverview = DATA.pricing_overview||[]; renderObjectTable('pricingTable', pProducts); renderKVTable('pricingKV', pOverview); try{ const plabels=pOverview.map(r=>r.metric); const pvals=pOverview.map(r=>r.value); const ctxP=document.getElementById('pricingChart').getContext('2d'); new Chart(ctxP,{type:'doughnut',data:{labels:plabels,datasets:[{data:pvals,backgroundColor:['#7c3aed','#54e1ff','#22c55e']} ]},options:{maintainAspectRatio:false,responsive:true}}); }catch(e){}\n"
            "        // Recommendations\n"
            "        const rProducts = DATA.recommendations_products||[]; const rOverview = DATA.recommendations_overview||[]; renderObjectTable('recoTable', rProducts); renderKVTable('recoKV', rOverview); try{ const rlabels=rOverview.map(r=>r.metric); const rvals=rOverview.map(r=>r.value); const ctxR=document.getElementById('recoChart').getContext('2d'); new Chart(ctxR,{type:'bar',data:{labels:rlabels,datasets:[{label:'Count',data:rvals,backgroundColor:'#54e1ff'}]},options:{maintainAspectRatio:false,responsive:true}}); }catch(e){}\n"
            "        // Segmentation\n"
            "        const segCustomers = DATA.segmentation_customers||[]; renderObjectTable('segTable', segCustomers); try{ const segCounts={}; (segCustomers||[]).forEach(s=>{ const k=s.segment||'UNKNOWN'; segCounts[k]=(segCounts[k]||0)+1 }); const slabels=Object.keys(segCounts); const svals=slabels.map(k=>segCounts[k]); const ctxS=document.getElementById('segChart').getContext('2d'); new Chart(ctxS,{type:'pie',data:{labels:slabels,datasets:[{data:svals,backgroundColor:['#7c3aed','#54e1ff','#22c55e','#f7c945','#ef4444']}]},options:{maintainAspectRatio:false,responsive:true}}); }catch(e){}\n"
            "        // Seasonal\n"
            "        const sSeries = DATA.seasonal_daily_forecast||[]; renderObjectTable('seasonalTable', sSeries); try{ const slabels=sSeries.map(r=>r.ds); const spred=sSeries.map(r=>r.yhat); const supper=sSeries.map(r=>r.yhat_upper); const slower=sSeries.map(r=>r.yhat_lower); const ctxSe=document.getElementById('seasonalChart').getContext('2d'); new Chart(ctxSe,{type:'line',data:{labels:slabels,datasets:[{label:'Predicted Revenue',data:spred,borderColor:'#7c3aed',backgroundColor:'rgba(124,58,237,0.1)',fill:true,tension:0.4,pointRadius:5,pointBackgroundColor:'#7c3aed'},{label:'Upper Bound',data:supper,borderColor:'#22c55e',borderDash:[5,5],fill:false,tension:0.4,pointRadius:3},{label:'Lower Bound',data:slower,borderColor:'#ef4444',borderDash:[5,5],fill:false,tension:0.4,pointRadius:3}]},options:{maintainAspectRatio:false,responsive:true,plugins:{legend:{labels:{color:'#cbd5e1'},position:'top'}},scales:{x:{ticks:{color:'#9fb0c8'}},y:{ticks:{color:'#9fb0c8'},beginAtZero:false}}}}); }catch(e){}\n"
            "        // Raw data\n"
            "        try{ document.getElementById('rawPre').textContent = JSON.stringify(DATA, null, 2); }catch(e){}\n"
            "      }catch(e){console.warn('rendering failed',e)}\n"
            "    </script>\n"
            "  </main>\n"
            "</body>\n"
            "</html>\n"
        )

        resp = HttpResponse(html, content_type='text/html')
        resp['Content-Disposition'] = 'attachment; filename="SmartRetail_Reports_{}.html"'.format(datetime.now().strftime("%Y%m%d"))
        return resp
    except Exception as e:
        return Response({"detail": f"Failed to generate HTML report: {str(e)}"}, status=500)


# =====================================================================
# SALES FORECASTING (HISTORICAL + SIMPLE LINEAR)
# =====================================================================

def month_add(base_date: date, months: int) -> date:
    y = base_date.year
    m = base_date.month + months
    y += (m - 1) // 12
    m = ((m - 1) % 12) + 1
    return date(y, m, 1)


def build_monthly_series(months_back: int = 12):
    now = timezone.now()
    start_month = month_add(now.date().replace(day=1), -months_back)

    qs = (
        Order.objects.filter(
            placed_at__gte=start_month,
            status__in=["paid", "shipped", "delivered"],
        )
        .annotate(month=TruncMonth("placed_at"))
        .values("month")
        .annotate(revenue=Sum("total_inr"))
        .order_by("month")
    )

    series = []
    for row in qs:
        series.append(
            {
                "month": row["month"].date(),
                "revenue": float(row["revenue"] or 0),
            }
        )
    return series


def simple_linear_forecast(series, future_months: int = 6):
    if not series:
        return {
            "labels": [],
            "actual": [],
            "predicted": [],
            "metrics": {"confidence": 0.0, "mae": None, "rmse": None, "r2": None},
            "forecast_next_month": 0.0,
        }

    n = len(series)
    xs = list(range(n))
    ys = [s["revenue"] for s in series]

    x_mean = sum(xs) / n
    y_mean = sum(ys) / n

    num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    den = sum((x - x_mean) ** 2 for x in xs) or 1.0
    slope = num / den
    intercept = y_mean - slope * x_mean

    y_hat = [intercept + slope * x for x in xs]

    labels = []
    actual = []
    predicted = []

    for i, s in enumerate(series):
        labels.append(s["month"].strftime("%b %Y"))
        actual.append(round(s["revenue"], 2))
        predicted.append(round(y_hat[i], 2))

    last_month = series[-1]["month"]
    for i in range(future_months):
        future_date = month_add(last_month, i + 1)
        labels.append(future_date.strftime("%b %Y"))
        actual.append(None)
        predicted.append(round(intercept + slope * (n + i), 2))

    forecast_next_month = predicted[n] if len(predicted) > n else 0.0

    confidence = min(1.0, max(0.0, abs(slope) / (max(ys) or 1)))

    # Compute model performance on the historical portion (where actual values exist).
    # Use the first `n` points (historical) to compute MAE, RMSE and R^2.
    mae = None
    rmse = None
    r2 = None

    try:
        # historical predictions correspond to y_hat[0:n]
        errors = [ys[i] - y_hat[i] for i in range(n)]
        abs_errors = [abs(e) for e in errors]
        sq_errors = [e * e for e in errors]

        mae_val = sum(abs_errors) / n if n > 0 else 0.0
        mse_val = sum(sq_errors) / n if n > 0 else 0.0
        rmse_val = math.sqrt(mse_val)

        ss_res = sum(sq_errors)
        ss_tot = sum((y - y_mean) ** 2 for y in ys) if n > 0 else 0.0

        r2_val = 1.0
        if ss_tot > 0:
            r2_val = 1.0 - (ss_res / ss_tot)

        mae = round(mae_val, 2)
        rmse = round(rmse_val, 2)
        r2 = round(r2_val, 3)
    except Exception:
        mae = None
        rmse = None
        r2 = None

    return {
        "labels": labels,
        "actual": actual,
        "predicted": predicted,
        "metrics": {
            "confidence": round(confidence, 3),
            "mae": mae,
            "rmse": rmse,
            "r2": r2,
        },
        "forecast_next_month": round(forecast_next_month, 2),
    }


@api_view(["GET"])
@permission_classes([AllowAny])
def forecasting_overview(request):
    cfg = ensure_config()
    # allow public access when requesting Power BI combined export
    p = str(request.GET.get("powerbi", "") or "").lower()
    is_powerbi = p in ("1", "true", "yes")
    if not is_powerbi:
        # enforce authentication for normal UI requests
        if not getattr(request, "user", None) or not request.user.is_authenticated:
            return Response({"detail": "Not authenticated"}, status=403)
    live = cfg.global_enabled and cfg.features.get("sales_forecasting", True)

    if not live:
        cache = MLCache.objects.filter(feature="sales_forecasting").first()
        if cache:
            return Response(cache.payload)

    # Power BI combined export: return a single, flat, table-oriented JSON
    # when the query flag `powerbi=1` (or true/yes) is provided.
    p = str(request.GET.get("powerbi", "") or "").lower()
    if p in ("1", "true", "yes"):
        try:
            # Forecasting series and overview
            series = build_monthly_series(12) or []
            forecast = simple_linear_forecast(series, 6) if series else simple_linear_forecast([], 6)
            forecasting_series = []
            labels = forecast.get("labels", [])
            actuals = forecast.get("actual", [])
            predicted = forecast.get("predicted", [])
            for i, lbl in enumerate(labels or []):
                forecasting_series.append({
                    "label": str(lbl),
                    "actual": (actuals[i] if i < len(actuals) else None),
                    "predicted": (predicted[i] if i < len(predicted) else None),
                })

            forecasting_overview_rows = [
                {"metric": "Next Month Forecast", "value": float(forecast.get("forecast_next_month") or 0)},
                {"metric": "Confidence Score", "value": float(forecast.get("metrics", {}).get("confidence") or 0)},
            ]

            # Inventory (rows + overview)
            inv_rows = compute_inventory_rows() or []
            inv_products = [
                {
                    "id": int(r.get("id") or 0),
                    "name": str(r.get("name") or ""),
                    "category": r.get("category"),
                    "stock": int(r.get("stock") or 0),
                    "velocity": float(r.get("velocity") or 0.0),
                    "days_left": (float(r.get("days_left")) if r.get("days_left") is not None else None),
                    "risk": r.get("risk") or "",
                    "reorder_qty": int(r.get("reorder_qty") or 0),
                    "price": float(r.get("price") or 0.0),
                    "base_price": float(r.get("base_price") or 0.0),
                }
                for r in inv_rows
            ]
            inv_overview = compute_inventory_overview(inv_rows) or {}
            inv_overview_rows = [{"metric": k, "value": inv_overview.get(k)} for k in ["total_products", "high_risk", "medium_risk", "low_risk", "total_stock", "total_reorder_needed", "avg_days_supply"]]

            # Pricing
            pricing_products = compute_pricing_products() or []
            pricing_products_rows = [
                {
                    "id": int(p.get("id") or 0),
                    "name": str(p.get("name") or ""),
                    "category": p.get("category"),
                    "old_price": float(p.get("old_price") or 0.0),
                    "new_price": float(p.get("new_price") or 0.0),
                    "change_percent": float(p.get("change") or 0.0),
                    "ai_reason": p.get("ai_reason") or "",
                }
                for p in pricing_products
            ]
            pricing_overview_rows = [{"metric": "Optimized Prices", "value": len(pricing_products_rows)}, {"metric": "Acceptance Rate", "value": 100.0}, {"metric": "Avg Discount", "value": 0.0}, {"metric": "Revenue Gain", "value": 0.0}]

            # Recommendations (compute directly to avoid permission checks)
            reco_overview = {
                "active_products": Product.objects.filter(is_active=True).count(),
                "total_interactions": CustomerBehavior.objects.count(),
                "total_orders": Order.objects.count(),
                "model_type": "Co-purchase frequency + Segment-aware",
                "status": "LIVE" if (cfg.global_enabled and cfg.features.get("recommendation_engine", True)) else "CACHED",
            }
            # prepare recent sales signal for demand score
            limit = int(request.GET.get("limit", 50))
            now = timezone.now()
            since = now - timedelta(days=60)
            sales = OrderItem.objects.filter(
                order__placed_at__gte=since,
                order__status__in=["paid", "shipped", "delivered"],
            )
            units_sold = defaultdict(int)
            for s in sales:
                units_sold[s.product_id] += s.quantity
            max_units = max(units_sold.values()) if units_sold else 1

            products = compute_recommendations(product_id=None, limit=limit, segment=None)
            reco_products_rows = []
            for p in products:
                sold = units_sold.get(p.id, 0)
                demand_score = min(100, int((sold / max_units) * 100) if max_units > 0 else 0)
                if demand_score >= 75:
                    reason = "High demand"
                elif demand_score >= 40:
                    reason = "Moderate demand"
                else:
                    reason = "Low demand"

                reco_products_rows.append({
                    "id": int(p.id or 0),
                    "name": p.name or "",
                    "price": float(p.current_price or p.base_price or p.price or 0),
                    "category": p.category,
                    "stock": int(p.stock) if p.stock else 0,
                    "demand_score": demand_score,
                    "reason": reason,
                })

            reco_overview_rows = [{"metric": k, "value": reco_overview.get(k)} for k in ["active_products", "total_interactions", "total_orders", "model_type", "status"]]

            # Segmentation
            seg_rows = compute_segments() or []
            seg_customers_rows = [
                {
                    "user_id": int(s.get("user_id") or 0),
                    "name": s.get("name") or "",
                    "email": s.get("email") or "",
                    "orders": int(s.get("orders") or 0),
                    "total_spent": float(s.get("total_spent") or 0.0),
                    "recency_days": (int(s.get("recency_days")) if s.get("recency_days") is not None else None),
                    "segment": s.get("segment") or "",
                }
                for s in seg_rows
            ]
            seg_overview = compute_segmentation_overview(seg_rows) or {}
            seg_overview_rows = [{"metric": k, "value": seg_overview.get(k)} for k in ["total_customers"]]

            # Seasonal (short horizon to keep payload reasonable)
            history = build_daily_history(days=365) or []
            seasonal_forecast = simple_seasonal_forecast(history, horizon_days=90) if history else []
            seasonal_rows = [
                {"ds": s.get("ds"), "yhat": float(s.get("yhat") or 0.0), "yhat_lower": float(s.get("yhat_lower") or 0.0), "yhat_upper": float(s.get("yhat_upper") or 0.0)}
                for s in seasonal_forecast
            ]
            seasonal_overview = compute_seasonal_overview(history) or {}
            seasonal_overview_rows = [{"metric": k, "value": seasonal_overview.get(k)} for k in ["has_model", "total_products", "last_trained_at"]]

            # Build final combined payload with flat arrays and empty arrays if missing
            combined = {
                "forecasting_overview": forecasting_overview_rows or [],
                "forecasting_series": forecasting_series or [],
                "inventory_overview": inv_overview_rows or [],
                "inventory_products": inv_products or [],
                "pricing_overview": pricing_overview_rows or [],
                "pricing_products": pricing_products_rows or [],
                "recommendations_overview": reco_overview_rows or [],
                "recommendations_products": reco_products_rows or [],
                "segmentation_overview": seg_overview_rows or [],
                "segmentation_customers": seg_customers_rows or [],
                "seasonal_overview": seasonal_overview_rows or [],
                "seasonal_daily_forecast": seasonal_rows or [],
            }

            return Response(combined)
        except Exception:
            # If combined export fails, fall back to normal behavior below
            pass

    series = build_monthly_series(12)
    forecast = simple_linear_forecast(series, 6)

    payload = {
        "forecast_next_month": forecast["forecast_next_month"],
        "confidence_score": forecast["metrics"]["confidence"],
        "period_label": "Next Month",
        "model_name": "Linear Regression",
        "last_trained_at": timezone.now().isoformat(),
        "metrics": forecast["metrics"],  # includes confidence, mae/rmse/r2 null
        "series": {
            "labels": forecast["labels"],
            "actual": forecast["actual"],
            "predicted": forecast["predicted"],
        },
    }

    MLCache.objects.update_or_create(
        feature="sales_forecasting",
        defaults={"payload": payload},
    )

    mark_feature_cached(cfg, "sales_forecasting")
    return Response(payload)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def forecasting_recompute(request):
    # Call forecasting_overview with the underlying Django HttpRequest to avoid
    # DRF request-wrapping issues. Be defensive: forecasting_overview may
    # return different response types (DRF Response or HttpResponse), so
    # attempt to extract a JSON payload, and fall back to recomputing the
    # forecast directly if necessary.
    raw_request = getattr(request, '_request', request)

    payload = {}
    try:
        res = forecasting_overview(raw_request)

        # If DRF Response with .data, prefer that
        if hasattr(res, 'data') and isinstance(res.data, dict):
            payload = res.data
        else:
            # Try to parse HttpResponse.content (bytes)
            content = getattr(res, 'content', None)
            if content:
                try:
                    payload = json.loads(content.decode('utf-8'))
                except Exception:
                    payload = {}

    except Exception:
        payload = {}

    # If forecast keys absent, compute directly
    if not payload or 'forecast_next_month' not in payload:
        try:
            series = build_monthly_series(12)
            forecast = simple_linear_forecast(series, 6)
            payload = {
                "forecast_next_month": forecast.get("forecast_next_month"),
                "confidence_score": forecast.get("metrics", {}).get("confidence"),
            }
        except Exception:
            payload = {"forecast_next_month": 0.0, "confidence_score": 0.0}

    return Response(
        {
            "detail": "Sales forecasting recomputed.",
            "forecast_next_month": payload.get("forecast_next_month"),
            "confidence_score": payload.get("confidence_score"),
        }
    )

# ===================== CONTINUES IN PART 2 =====================
# =====================================================================
# INVENTORY OPTIMIZATION (VELOCITY + RISK)
# =====================================================================

def can_view_inventory(user):
    try:
        return user.profile.role in ("admin", "staff")
    except Profile.DoesNotExist:
        return False


def inventory_live():
    cfg = ensure_config()
    enabled = cfg.global_enabled and cfg.features.get("inventory_optimization", True)
    return cfg, enabled


def compute_inventory_rows():
    """Enhanced inventory calculation with better metrics"""
    now = timezone.now()
    days = 30
    since = now - timedelta(days=days)

    # Get sales data for the last 30 days
    items = (
        OrderItem.objects
        .filter(order__placed_at__gte=since)
        .select_related("product")
    )

    sold = {}
    for it in items:
        sold[it.product_id] = sold.get(it.product_id, 0) + it.quantity

    products = Product.objects.filter(is_active=True)
    rows = []

    for p in products:
        total_sold = sold.get(p.id, 0)
        # Calculate daily velocity (units per day)
        velocity = round(total_sold / days, 2) if total_sold > 0 else 0.0
        stock = int(p.stock) if p.stock else 0

        # Calculate days of stock remaining
        if velocity > 0:
            days_left = round(stock / velocity, 1)
        else:
            days_left = None

        # Determine risk level based on days of stock
        if days_left is None:
            risk = "LOW"
        elif days_left <= 7:
            risk = "HIGH"
        elif days_left <= 20:
            risk = "MEDIUM"
        else:
            risk = "LOW"

        # Calculate reorder quantity (30-day supply target)
        reorder_qty = 0
        if risk != "LOW" and velocity > 0:
            from math import ceil
            target_stock = 30 * velocity  # Target 30 days of supply
            reorder_qty = max(0, ceil(target_stock - stock))

        rows.append(
            {
                "id": p.id,
                "name": p.name,
                "category": p.category,
                "stock": stock,
                "velocity": velocity,
                "days_left": days_left,
                "risk": risk,
                "reorder_qty": reorder_qty,
                "image": p.image.url if p.image else None,
                "price": float(p.current_price or p.base_price or p.price or 0),
                "base_price": float(p.base_price or p.price or 0),
            }
        )

    return rows


def compute_inventory_overview(rows):
    """Enhanced overview with better insights"""
    total_products = len(rows)
    high = sum(1 for r in rows if r["risk"] == "HIGH")
    medium = sum(1 for r in rows if r["risk"] == "MEDIUM")
    low = total_products - high - medium

    # Calculate total stock and reorder needs
    total_stock = sum(r["stock"] for r in rows)
    total_reorder = sum(r["reorder_qty"] for r in rows)
    avg_days_left = sum(r["days_left"] for r in rows if r["days_left"]) / max(1, len([r for r in rows if r["days_left"]]))

    insights = []
    
    if high > 0:
        insights.append(
            f"🚨 {high} products at HIGH stock-out risk (< 7 days supply). Reorder immediately!"
        )
    
    if medium > 0:
        insights.append(
            f"⚠️ {medium} products at MEDIUM risk (7-20 days supply). Plan reorders soon."
        )
    
    if total_reorder > 0:
        insights.append(
            f"📦 Recommend ordering {int(total_reorder)} units total to maintain optimal stock levels."
        )
    
    if high == 0 and medium == 0:
        insights.append("✅ All inventory levels are healthy!")

    insights.append(
        f"📊 Current average stock: {avg_days_left:.1f} days supply across all products."
    )

    return {
        "total_products": total_products,
        "high_risk": high,
        "medium_risk": medium,
        "low_risk": low,
        "total_stock": total_stock,
        "total_reorder_needed": int(total_reorder),
        "avg_days_supply": round(avg_days_left, 1),
        "insights": insights,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def inventory_overview(request):
    """Get inventory overview with optimization metrics"""
    if not can_view_inventory(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    cfg, live = inventory_live()

    # Only use cache if automation is OFF
    if not live:
        cache = MLCache.objects.filter(feature="inventory_overview").first()
        if cache:
            return Response(cache.payload)

    # Compute fresh inventory data
    rows = compute_inventory_rows()
    overview = compute_inventory_overview(rows)

    # Cache the result
    MLCache.objects.update_or_create(
        feature="inventory_overview",
        defaults={"payload": overview},
    )

    mark_feature_cached(cfg, "inventory_optimization")
    return Response(overview)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def inventory_products(request):
    """Get detailed inventory for all products"""
    if not can_view_inventory(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    cfg, live = inventory_live()

    if not live:
        cache = MLCache.objects.filter(feature="inventory_products").first()
        if cache:
            return Response(cache.payload)

    rows = compute_inventory_rows()

    # Sort by risk level (HIGH first, then MEDIUM, then LOW)
    risk_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    rows.sort(key=lambda x: (risk_order[x["risk"]], -x["velocity"]))

    MLCache.objects.update_or_create(
        feature="inventory_products",
        defaults={"payload": rows},
    )

    mark_feature_cached(cfg, "inventory_optimization")
    return Response(rows)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def inventory_recommend(request):
    """Apply reorder recommendations"""
    if not can_view_inventory(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    product_ids = request.data.get("product_ids", [])
    quantities = request.data.get("quantities", {})

    if not product_ids:
        return Response(
            {"detail": "No products specified"},
            status=400
        )

    # Update product stocks based on recommendations
    updated = []
    for product_id in product_ids:
        try:
            product = Product.objects.get(id=product_id)
            qty = quantities.get(str(product_id), 0)
            
            if qty > 0:
                old_stock = product.stock
                product.stock += int(qty)
                product.save(update_fields=['stock'])
                
                updated.append({
                    "id": product.id,
                    "name": product.name,
                    "old_stock": old_stock,
                    "new_stock": product.stock,
                    "added": int(qty),
                })
        except Product.DoesNotExist:
            pass

    # Clear cache to show updated data
    MLCache.objects.filter(feature__startswith="inventory").delete()

    return Response(
        {
            "success": True,
            "message": f"Stock updated for {len(updated)} products.",
            "updated": updated,
        }
    )

# =====================================================================
# DYNAMIC PRICING (DEMAND + INVENTORY + SEASONALITY)
# =====================================================================
def can_view_pricing(user):
    try:
        return user.profile.role in ("admin", "staff")
    except Exception:
        return False

def compute_pricing_products():
    now = timezone.now()
    since = now - timedelta(days=60)

    products = Product.objects.filter(is_active=True)

    # ---------------- SALES SIGNAL ----------------
    sales = OrderItem.objects.filter(
        order__placed_at__gte=since,
        order__status__in=["paid", "shipped", "delivered"],
    )

    units_sold = defaultdict(int)
    for s in sales:
        units_sold[s.product_id] += s.quantity

    max_units = max(units_sold.values()) if units_sold else 1

    # ---------------- SEASONALITY ----------------
    seasonal_factor = 1 + (0.12 * sin(2 * pi * (now.month / 12)))

    results = []

    for p in products:
        # Use current_price if set, otherwise base_price, otherwise price
        base = Decimal(p.current_price or p.base_price or p.price or 0)
        
        # Skip only if truly zero
        if base <= 0:
            base = Decimal("100")  # Default fallback price

        sold = units_sold.get(p.id, 0)
        demand_score = min(100, int((sold / max_units) * 100) if max_units > 0 else 0)

        if demand_score >= 75:
            demand_factor = Decimal("1.12")
            reason = "High demand"
        elif demand_score >= 40:
            demand_factor = Decimal("1.05")
            reason = "Moderate demand"
        else:
            demand_factor = Decimal("0.95")
            reason = "Low demand"

        stock_factor = (
            Decimal("1.10") if p.stock < 10 else
            Decimal("0.95") if p.stock > 100 else
            Decimal("1.00")
        )

        raw = base * demand_factor * stock_factor * Decimal(seasonal_factor)

        min_p = base * Decimal("0.80")
        max_p = base * Decimal("1.25")

        new_price = max(min(raw, max_p), min_p).quantize(Decimal("0.01"))

        results.append({
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "old_price": float(base),
            "new_price": float(new_price),
            "change": round(((new_price - base) / base) * 100, 2) if base > 0 else 0,
            "ai_reason": reason,
            "image": p.image.url if p.image else None,
        })

    return results

def apply_dynamic_pricing(products_data):
    now = timezone.now()
    applied = []

    for row in products_data:
        product = get_object_or_404(Product, id=row["id"])

        new_price = Decimal(str(row["new_price"]))
        old_price = product.current_price or product.base_price

        if new_price != old_price:
            PriceAdjustment.objects.create(
                product=product,
                old_price=old_price,
                new_price=new_price,
                percentage_change=float(
                    ((new_price - old_price) / old_price) * 100
                ),
            )

            product.current_price = new_price
            product.price_source = "dynamic"
            product.last_price_update = now
            product.save(
                update_fields=[
                    "current_price",
                    "price_source",
                    "last_price_update",
                ]
            )

        applied.append({
            "id": product.id,
            "old_price": float(old_price),
            "new_price": float(new_price),
        })

    return applied

# ===================== CONTINUES IN PART 3 =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pricing_overview(request):
    if not can_view_pricing(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    cfg = ensure_config()

    if not cfg.global_enabled or not cfg.features.get("dynamic_pricing", True):
        cache = MLCache.objects.filter(feature="dynamic_pricing").first()
        if cache:
            return Response(cache.payload)

    products = compute_pricing_products()

    payload = {
        "optimized_prices": len(products),
        "acceptance_rate": 100.0,
        "avg_discount": 0.0,
        "revenue_gain": 0.0,
        "insights": ["AI pricing generated based on demand & stock"],
    }

    MLCache.objects.update_or_create(
        feature="dynamic_pricing",
        defaults={"payload": payload},
    )

    mark_feature_cached(cfg, "dynamic_pricing")
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pricing_products(request):
    if not can_view_pricing(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    cfg = ensure_config()

    if not cfg.global_enabled or not cfg.features.get("dynamic_pricing", True):
        cache = MLCache.objects.filter(feature="dynamic_pricing_products").first()
        if cache:
            return Response(cache.payload)

    products = compute_pricing_products()

    MLCache.objects.update_or_create(
        feature="dynamic_pricing_products",
        defaults={"payload": products},
    )

    mark_feature_cached(cfg, "dynamic_pricing")
    return Response(products)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def pricing_apply(request):
    if not can_view_pricing(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    cfg = ensure_config()
    
    # Get all active products or specific ones from request
    product_ids = request.data.get("product_ids", [])
    
    if product_ids:
        products = Product.objects.filter(id__in=product_ids, is_active=True)
    else:
        products = Product.objects.filter(is_active=True)

    applied = []
    
    # Import here to avoid circular imports
    from ml_engine.services import apply_dynamic_pricing as service_apply_pricing
    
    for product in products:
        new_price, mode = service_apply_pricing(product)
        applied.append({
            "id": product.id,
            "name": product.name,
            "old_price": float(product.base_price or product.price or 0),
            "new_price": float(new_price),
            "mode": mode,
        })

    mark_feature_cached(cfg, "dynamic_pricing")
    
    return Response({
        "success": True,
        "applied_count": len(applied),
        "applied": applied,
        "mode": "LIVE" if (cfg.global_enabled and cfg.features.get("dynamic_pricing", True)) else "CACHED",
    })


# =====================================================================
# RECOMMENDATION ENGINE (CO-PURCHASE BASED)
# =====================================================================

def can_view_reco(user):
    try:
        return user.profile.role in ("admin", "staff")
    except Profile.DoesNotExist:
        return False


def reco_live():
    cfg = ensure_config()
    enabled = cfg.global_enabled and cfg.features.get(
        "recommendation_engine", True
    )
    return cfg, enabled


def build_co_purchase_matrix():
    co_matrix = defaultdict(Counter)

    # ---- Orders signal (strong)
    items = OrderItem.objects.select_related("order", "product")
    order_products = defaultdict(set)

    for it in items:
        order_products[it.order_id].add(it.product_id)

    for products in order_products.values():
        for p in products:
            for q in products:
                if p != q:
                    co_matrix[p][q] += 3  # higher weight

    # ---- Behavior signal (weak but important)
    behavior = CustomerBehavior.objects.filter(
        action__in=["view", "wishlist", "cart"]
    )

    for b in behavior:
        if b.product_id:
            co_matrix[b.product_id][b.product_id] += 1

    return co_matrix


def compute_recommendations(product_id=None, limit=6, segment=None):
    """
    Segment-aware recommendations:
    - If segment provided, prefer products per mapping.
    - Fallback to co-purchase matrix / popularity.
    """
    co_matrix = build_co_purchase_matrix()

    # If a specific product context exists, preserve co-purchase logic first
    if product_id and co_matrix and product_id in co_matrix:
        counter = co_matrix[product_id]
        top_ids = [pid for pid, _ in counter.most_common(limit)]
        return Product.objects.filter(id__in=top_ids, is_active=True)[:limit]

    # Segment-based promotion rules
    if segment == "VIP":
        # Prefer higher priced, premium items
        return Product.objects.filter(is_active=True, base_price__gte=2000).order_by("-base_price")[:limit]

    if segment == "LOYAL":
        # Prefer most frequently purchased items across orders
        top = (
            OrderItem.objects
            .values("product_id")
            .annotate(total_qty=Sum("quantity"))
            .order_by("-total_qty")
            .values_list("product_id", flat=True)[:limit]
        )
        return Product.objects.filter(id__in=list(top), is_active=True)

    if segment == "NEW":
        # Recommend affordable / entry-level items
        return Product.objects.filter(is_active=True).order_by("base_price")[:limit]

    if segment in ("AT_RISK", "DORMANT"):
        # Promote discounted or overstocked items (current_price < base_price or high stock)
        return Product.objects.filter(is_active=True).filter(
            models.Q(current_price__lt=F("base_price")) | models.Q(stock__gt=100)
        ).order_by("-stock")[:limit]

    # Generic fallback: co-purchase based if available else popular recent products
    if co_matrix:
        popular_ids = [
            pid for pid, _ in Counter({k: sum(v.values()) for k, v in co_matrix.items()}).most_common(limit)
        ]
        return Product.objects.filter(id__in=popular_ids, is_active=True)[:limit]

    return Product.objects.filter(is_active=True).order_by("-created_at")[:limit]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recommended_products(request):
    """
    Returns recommendations personalized to the logged-in user's segment.
    GET params:
      - product_id (optional): context product
      - limit (optional)
    """
    product_id = request.GET.get("product_id")
    product_id = int(product_id) if product_id else None
    limit = int(request.GET.get("limit", 6))

    # get user segment safely
    try:
        user_segment = getattr(request.user.profile, "customer_segment", None)
    except Exception:
        user_segment = None

    # compute recommendations with segment context
    products = compute_recommendations(product_id=product_id, limit=limit, segment=user_segment)

    payload = [
        {
            "id": p.id,
            "name": p.name,
            "price": float(p.current_price or p.base_price or p.price or 0),
            "image": p.image.url if p.image else None,
            "category": p.category,
        }
        for p in products
    ]

    # cache personalized recommendations for this segment (light cache key)
    if user_segment:
        cache_key = f"recommendations_segment_{user_segment}"
        MLCache.objects.update_or_create(
            feature=cache_key,
            defaults={"payload": payload},
        )

    mark_feature_cached(ensure_config(), "recommendation_engine")
    return Response(payload)


# =====================================================================
# RECOMMENDATION ENGINE - ADMIN ENDPOINTS
# =====================================================================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recommendation_overview(request):
    """Admin endpoint: recommendation engine overview"""
    if not can_view_reco(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    cfg, live = reco_live()

    if not live:
        cache = MLCache.objects.filter(feature="recommendation_overview").first()
        if cache:
            return Response(cache.payload)

    payload = {
        "active_products": Product.objects.filter(is_active=True).count(),
        "total_interactions": CustomerBehavior.objects.count(),
        "total_orders": Order.objects.count(),
        "model_type": "Co-purchase frequency + Segment-aware",
        "status": "LIVE" if live else "CACHED",
    }

    MLCache.objects.update_or_create(
        feature="recommendation_overview",
        defaults={"payload": payload},
    )

    mark_feature_cached(cfg, "recommendation_engine")
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recommendation_products(request):
    """Admin endpoint: get all product recommendations"""
    if not can_view_reco(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    limit = int(request.GET.get("limit", 10))
    cfg, live = reco_live()

    if not live:
        cache = MLCache.objects.filter(feature="recommendation_products").first()
        if cache:
            return Response(cache.payload)

    # Get pricing data for demand info
    now = timezone.now()
    since = now - timedelta(days=60)
    sales = OrderItem.objects.filter(
        order__placed_at__gte=since,
        order__status__in=["paid", "shipped", "delivered"],
    )
    units_sold = defaultdict(int)
    for s in sales:
        units_sold[s.product_id] += s.quantity
    max_units = max(units_sold.values()) if units_sold else 1

    products = compute_recommendations(product_id=None, limit=limit, segment=None)

    payload = []
    for p in products:
        sold = units_sold.get(p.id, 0)
        demand_score = min(100, int((sold / max_units) * 100) if max_units > 0 else 0)
        
        if demand_score >= 75:
            reason = "High demand"
        elif demand_score >= 40:
            reason = "Moderate demand"
        else:
            reason = "Low demand"

        payload.append({
            "id": p.id,
            "name": p.name,
            "price": float(p.current_price or p.base_price or p.price or 0),
            "image": p.image.url if p.image else None,
            "category": p.category,
            "stock": int(p.stock) if p.stock else 0,
            "demand_score": demand_score,
            "reason": reason,
        })

    MLCache.objects.update_or_create(
        feature="recommendation_products",
        defaults={"payload": payload},
    )

    mark_feature_cached(cfg, "recommendation_engine")
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recommendation_top(request):
    """
    Top recommendations (admin + customer shared endpoint).
    GET params: limit (default 10)
    """
    if not can_view_reco(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    limit = int(request.GET.get("limit", 10))
    cfg, live = reco_live()

    if not live:
        cache = MLCache.objects.filter(feature="recommendations_top").first()
        if cache:
            return Response(cache.payload)

    # Get pricing data for demand info
    now = timezone.now()
    since = now - timedelta(days=60)
    sales = OrderItem.objects.filter(
        order__placed_at__gte=since,
        order__status__in=["paid", "shipped", "delivered"],
    )
    units_sold = defaultdict(int)
    for s in sales:
        units_sold[s.product_id] += s.quantity
    max_units = max(units_sold.values()) if units_sold else 1

    products = compute_recommendations(product_id=None, limit=limit, segment=None)

    payload = []
    for p in products:
        sold = units_sold.get(p.id, 0)
        demand_score = min(100, int((sold / max_units) * 100) if max_units > 0 else 0)
        
        if demand_score >= 75:
            reason = "High demand"
        elif demand_score >= 40:
            reason = "Moderate demand"
        else:
            reason = "Low demand"

        payload.append({
            "id": p.id,
            "name": p.name,
            "price": float(p.current_price or p.base_price or p.price or 0),
            "image": p.image.url if p.image else None,
            "category": p.category,
            "demand_score": demand_score,
            "reason": reason,
        })

    MLCache.objects.update_or_create(
        feature="recommendations_top",
        defaults={"payload": payload},
    )

    mark_feature_cached(cfg, "recommendation_engine")
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recommendation_for_product(request):
    """
    Recommendations for a given product_id (query param).
    Admin endpoint version.
    GET params: product_id (required), limit (optional, default 6)
    """
    product_id = request.GET.get("product_id")
    if not product_id:
        return Response({"detail": "product_id query parameter required"}, status=400)

    try:
        product_id = int(product_id)
    except ValueError:
        return Response({"detail": "product_id must be an integer"}, status=400)

    if not can_view_reco(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    limit = int(request.GET.get("limit", 6))
    cfg, live = reco_live()
    cache_key = f"recommendations_product_{product_id}"

    if not live:
        cache = MLCache.objects.filter(feature=cache_key).first()
        if cache:
            return Response(cache.payload)

    # Get pricing data for demand info
    now = timezone.now()
    since = now - timedelta(days=60)
    sales = OrderItem.objects.filter(
        order__placed_at__gte=since,
        order__status__in=["paid", "shipped", "delivered"],
    )
    units_sold = defaultdict(int)
    for s in sales:
        units_sold[s.product_id] += s.quantity
    max_units = max(units_sold.values()) if units_sold else 1

    products = compute_recommendations(product_id=product_id, limit=limit, segment=None)

    payload = []
    for p in products:
        sold = units_sold.get(p.id, 0)
        demand_score = min(100, int((sold / max_units) * 100) if max_units > 0 else 0)
        
        if demand_score >= 75:
            reason = "High demand"
        elif demand_score >= 40:
            reason = "Moderate demand"
        else:
            reason = "Low demand"

        payload.append({
            "id": p.id,
            "name": p.name,
            "price": float(p.current_price or p.base_price or p.price or 0),
            "image": p.image.url if p.image else None,
            "category": p.category,
            "demand_score": demand_score,
            "reason": reason,
        })

    MLCache.objects.update_or_create(
        feature=cache_key,
        defaults={"payload": payload},
    )

    mark_feature_cached(cfg, "recommendation_engine")
    return Response(payload)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def recommendation_retrain(request):
    """
    Trigger retrain / refresh of recommendation caches.
    """
    if not can_view_reco(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    MLCache.objects.filter(feature__startswith="recommendations").delete()
    mark_feature_cached(ensure_config(), "recommendation_engine")

    return Response({"status": "ok", "message": "Recommendation engine retraining started"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def recommendation_log_apply(request):
    """
    Save manual recommendation log (keeps API name expected by urls).
    """
    if not can_view_reco(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    product_ids = request.data.get("product_ids", [])
    RecommendationLog.objects.create(
        num_products=len(product_ids),
        metadata={"product_ids": product_ids},
    )

    return Response({"status": "saved"})

# -------------------------
# CUSTOMER SEGMENTATION HELPERS / ENDPOINTS (adjusted)
# -------------------------
from django.contrib.auth import get_user_model
User = get_user_model()

# =====================================================================
# CUSTOMER SEGMENTATION (RFM STYLE) - HELPERS
# =====================================================================

def can_view_segmentation(user):
    """Check if user can view segmentation data (admin/staff)"""
    try:
        return user.profile.role in ("admin", "staff")
    except Profile.DoesNotExist:
        return False


def segmentation_live():
    """Check if segmentation automation is live"""
    cfg = ensure_config()
    enabled = cfg.global_enabled and cfg.features.get("customer_segmentation", True)
    return cfg, enabled


def assign_segment(recency_days, frequency, monetary):
    """Assign RFM-based segment"""
    if frequency >= 10 and monetary >= 50000:
        return "VIP"
    if frequency >= 5 and monetary >= 20000:
        return "LOYAL"
    if frequency >= 3 and recency_days <= 60:
        return "ACTIVE"
    if frequency <= 2 and recency_days <= 30:
        return "NEW"
    if recency_days > 120:
        return "DORMANT"
    return "AT_RISK"


def compute_segmentation_overview(rows):
    """Compute overview stats from rows"""
    counts = {}
    for r in rows:
        seg = r["segment"]
        counts[seg] = counts.get(seg, 0) + 1

    insights = []
    if counts.get("VIP"):
        insights.append(f"{counts['VIP']} VIP customers — retain aggressively.")
    if counts.get("AT_RISK"):
        insights.append(f"{counts['AT_RISK']} at-risk customers — re-engagement offers.")
    if counts.get("DORMANT"):
        insights.append(f"{counts['DORMANT']} dormant — consider win-back campaigns.")
    if not insights:
        insights.append("Customer activity is well distributed.")

    return {
        "total_customers": len(rows),
        "segments": counts,
        "insights": insights,
    }


def compute_segments():
    """
    Compute RFM segments for customers based on last 365 days orders.
    Persist customer_segment on Profile for all users:
      - Users with orders: segment from RFM logic
      - Users without orders: 'NEW' (default)
    Returns rows (list of dicts) for all profiles.
    """
    now = timezone.now()
    since = now - timedelta(days=365)

    # Aggregate orders per customer
    orders = (
        Order.objects.filter(
            placed_at__gte=since,
            status__in=["paid", "shipped", "delivered"],
        )
        .values("customer")
        .annotate(
            total_spend=Sum("total_inr"),
            total_orders=Count("id"),
            last_order=Max("placed_at"),
        )
    )

    # Map customer_id -> metrics
    metrics_by_customer = {o["customer"]: o for o in orders}

    rows = []
    processed_user_ids = set()

    # First, process customers who have orders
    for cust_id, m in metrics_by_customer.items():
        try:
            user = User.objects.get(id=cust_id)
            profile = user.profile
        except Exception:
            continue

        recency_days = (now - m["last_order"]).days if m.get("last_order") else 9999
        frequency = m["total_orders"] or 0
        monetary = float(m["total_spend"] or 0)

        segment = assign_segment(recency_days, frequency, monetary)

        # Persist only if changed
        if getattr(profile, "customer_segment", None) != segment:
            profile.customer_segment = segment
            profile.save(update_fields=["customer_segment"])

        rows.append(
            {
                "user_id": user.id,
                "name": getattr(profile, "full_name", None) or user.username,
                "email": user.email,
                "orders": frequency,
                "total_spent": monetary,
                "recency_days": recency_days,
                "segment": segment,
            }
        )
        processed_user_ids.add(user.id)

    # Now ensure remaining profiles (no orders) have a default segment (NEW)
    remaining_profiles = Profile.objects.exclude(user__id__in=processed_user_ids)
    for profile in remaining_profiles.select_related("user")[:]:
        user = profile.user
        if not getattr(profile, "customer_segment", None):
            profile.customer_segment = "NEW"
            profile.save(update_fields=["customer_segment"])

        rows.append(
            {
                "user_id": user.id,
                "name": getattr(profile, "full_name", None) or user.username,
                "email": user.email,
                "orders": 0,
                "total_spent": 0.0,
                "recency_days": None,
                "segment": profile.customer_segment or "NEW",
            }
        )

    return rows


# =====================================================================
# SEGMENTATION ENDPOINTS
# =====================================================================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def segmentation_overview(request):
    """
    Admin view: segmentation overview.
    Uses cache when automation is OFF; otherwise recomputes.
    """
    if not can_view_segmentation(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    cfg, live = segmentation_live()

    if not live:
        cache = MLCache.objects.filter(feature="segmentation_overview").first()
        if cache:
            return Response(cache.payload)

    # compute (this persists segments on profiles)
    rows = compute_segments()
    overview = compute_segmentation_overview(rows)

    MLCache.objects.update_or_create(
        feature="segmentation_overview",
        defaults={"payload": overview},
    )
    MLCache.objects.update_or_create(
        feature="segmentation_customers",
        defaults={"payload": rows},
    )

    mark_feature_cached(cfg, "customer_segmentation")
    return Response(overview)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def segmentation_my_segment(request):
    """Return the segmentation label for the requesting user."""
    try:
        seg = getattr(request.user.profile, "customer_segment", None)
    except Exception:
        seg = None

    if not seg:
        try:
            compute_segments()
            seg = getattr(request.user.profile, "customer_segment", None)
        except Exception:
            seg = None

    return Response({"segment": seg})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def segmentation_recompute_all(request):
    """Admin only: recompute all customer segments"""
    if not is_admin(request.user):
        return Response({"detail": "Admin only"}, status=403)

    rows = compute_segments()
    MLCache.objects.update_or_create(
        feature="segmentation_customers",
        defaults={"payload": rows},
    )
    mark_feature_cached(ensure_config(), "customer_segmentation")
    return Response({"detail": "Segmentation recomputed", "updated": len(rows)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def segmentation_customers(request):
    """Return list of customer segmentation rows (admin/staff only)."""
    if not can_view_segmentation(request.user):
        return Response({"detail": "Not authorized"}, status=403)

    cfg, live = segmentation_live()

    if not live:
        cache = MLCache.objects.filter(feature="segmentation_customers").first()
        if cache:
            return Response(cache.payload)

    rows = compute_segments()

    MLCache.objects.update_or_create(
        feature="segmentation_customers",
        defaults={"payload": rows},
    )

    mark_feature_cached(cfg, "customer_segmentation")
    return Response(rows)


# =====================================================================
# SEASONAL TRENDS (SINE-BASED DAILY FORECAST)
# =====================================================================

def seasonal_live():
    cfg = ensure_config()
    enabled = cfg.global_enabled and cfg.features.get("seasonal_trends", True)
    return cfg, enabled


def build_daily_history(days: int = 365):
    now = timezone.now()
    since = now - timedelta(days=days)

    qs = (
        Order.objects.filter(
            placed_at__gte=since,
            status__in=["paid", "shipped", "delivered"],
        )
        .extra(select={"day": "date(placed_at)"})
        .values("day")
        .annotate(total=Sum("total_inr"))
        .order_by("day")
    )

    history = []
    for row in qs:
        history.append({"ds": row["day"], "y": float(row["total"] or 0)})
    return history


def simple_seasonal_forecast(history, horizon_days: int = 365):
    now = timezone.now()

    if not history:
        base = 0.0
    else:
        last30 = history[-30:] if len(history) > 30 else history
        base = sum(h["y"] for h in last30) / max(len(last30), 1)

    forecast = []
    for i in range(1, horizon_days + 1):
        day = now + timedelta(days=i)
        day_of_year = int(day.strftime("%j"))
        seasonal_factor = 0.2 * sin(2 * pi * day_of_year / 365.0)

        yhat = base * (1.0 + seasonal_factor)
        forecast.append(
            {
                "ds": day.date().isoformat(),
                "yhat": round(yhat, 2),
                "yhat_lower": round(yhat * 0.85, 2),
                "yhat_upper": round(yhat * 1.15, 2),
            }
        )

    return forecast


def compute_seasonal_overview(history):
    total_products = Product.objects.filter(is_active=True).count()
    has_model = bool(history)

    cache = MLCache.objects.filter(feature="seasonal_predictions").first()
    last_trained_at = cache.updated_at.isoformat() if cache else None

    return {"has_model": has_model, "total_products": total_products, "last_trained_at": last_trained_at}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def seasonal_overview(request):
    cfg, live = seasonal_live()

    if not live:
        cache = MLCache.objects.filter(feature="seasonal_overview").first()
        if cache:
            return Response(cache.payload)

    history = build_daily_history(days=365)
    overview = compute_seasonal_overview(history)

    MLCache.objects.update_or_create(feature="seasonal_overview", defaults={"payload": overview})
    mark_feature_cached(cfg, "seasonal_trends")
    return Response(overview)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def seasonal_predictions(request):
    cfg, live = seasonal_live()

    horizon = int(request.GET.get("horizon_days", 365))

    if not live:
        cache = MLCache.objects.filter(feature="seasonal_predictions").first()
        if cache:
            return Response(cache.payload)

    history = build_daily_history(days=365)
    forecast = simple_seasonal_forecast(history, horizon_days=horizon)

    payload = {"forecast": forecast}
    MLCache.objects.update_or_create(feature="seasonal_predictions", defaults={"payload": payload})
    mark_feature_cached(cfg, "seasonal_trends")
    return Response(payload)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def seasonal_recompute(request):
    horizon = int(request.data.get("horizon_days", 365))

    history = build_daily_history(days=365)
    forecast = simple_seasonal_forecast(history, horizon_days=horizon)

    MLCache.objects.update_or_create(feature="seasonal_predictions", defaults={"payload": {"forecast": forecast}})
    mark_feature_cached(ensure_config(), "seasonal_trends")
    return Response({"detail": "Seasonal model recomputed", "horizon_days": horizon})


# =====================================================================
# CUSTOMER BEHAVIOR TRACKING (FIXED)
# =====================================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def record_behavior(request):
    """
    Records lightweight customer behavior events.
    Used by customer pages (view, click, wishlist, cart, order).
    """
    product_id = request.data.get("product_id")
    product = None

    if product_id:
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            product = None

    CustomerBehavior.objects.create(
        user=request.user,
        product=product,
        action=request.data.get("action"),
        metadata=request.data.get("metadata", {}),
    )

    return Response(
        {"detail": "Behavior recorded"},
        status=status.HTTP_201_CREATED,
    )

# ----------------------------
# Backwards-compatible aliases
# ----------------------------
# Ensure common plural/singular names used by urls.py are present.

# alias mapping (do not overwrite existing functions)
if "recommendations_overview" not in globals() and "recommendation_overview" in globals():
    recommendations_overview = recommendation_overview

if "recommendation_overview" not in globals() and "recommendations_overview" in globals():
    recommendation_overview = recommendations_overview

if "recommended_products" not in globals() and "recommendations_recommended" in globals():
    recommended_products = recommendations_recommended

# keep both names for retrain / log apply variants
if "recommendation_retrain" not in globals() and "recommendations_retrain" in globals():
    recommendation_retrain = recommendations_retrain

if "recommendations_retrain" not in globals() and "recommendation_retrain" in globals():
    recommendations_retrain = recommendation_retrain

if "recommendation_log_apply" not in globals() and "recommendations_log_apply" in globals():
    recommendation_log_apply = recommendations_log_apply

# segmentation aliases
if "segmentation_my_segment" not in globals() and "segmentation_my_segment" in globals():
    pass  # already present

# =====================================================================
# ADMIN REPORTS API ENDPOINT
# =====================================================================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_reports_data(request):
    """Comprehensive reports data for admin dashboard"""
    if not is_admin(request.user):
        return Response({"detail": "Admin only"}, status=403)

    now = timezone.now()
    data = {}

    # Forecasting data
    series = build_monthly_series(12)
    forecast = simple_linear_forecast(series, 6)
    data["forecasting"] = {
        "forecast_next_month": forecast["forecast_next_month"],
        "confidence_score": forecast["metrics"]["confidence"],
    }

    # Inventory data
    rows = compute_inventory_rows()
    data["inventory"] = compute_inventory_overview(rows)

    # Pricing data
    products = compute_pricing_products()
    data["pricing"] = {
        "optimized_prices": len(products),
        "acceptance_rate": 100.0,
    }

    # Recommendations
    data["recommendations"] = {
        "active_products": Product.objects.filter(is_active=True).count(),
        "total_interactions": CustomerBehavior.objects.count(),
        "total_orders": Order.objects.count(),
    }

    # Segmentation
    rows = compute_segments()
    data["segmentation"] = compute_segmentation_overview(rows)

    # Seasonal
    history = build_daily_history(days=365)
    data["seasonal"] = compute_seasonal_overview(history)


# =====================================================================
# POWER BI TEMPLATE DOWNLOAD
# =====================================================================


@api_view(["GET"])
@permission_classes([AllowAny])
def powerbi_template_download(request):
    """
    Download a pre-configured Power BI template (.pbit) file.
    The template includes all SmartRetail analytics visuals with
    auto-connected data source pointing to the backend API.
    
    GET params (optional):
      - host: Override backend host for data source URL (default: request.get_host())
    """
    try:
        # Get the backend host for data source URL
        host = request.GET.get("host") or request.get_host()
        protocol = "https" if request.is_secure() else "http"
        backend_url = f"{protocol}://{host}"
        
        # Generate the template
        pbit_bytes = generate_powerbi_template(backend_url)
        
        # Return as file download
        response = FileResponse(
            io.BytesIO(pbit_bytes),
            content_type="application/octet-stream",
        )
        response["Content-Disposition"] = f'attachment; filename="SmartRetail_Reports_{datetime.now().strftime("%Y%m%d")}.pbit"'
        return response
    
    except Exception as e:
        return Response(
            {"detail": f"Failed to generate Power BI template: {str(e)}"},
            status=500,
        )

    return Response(data)