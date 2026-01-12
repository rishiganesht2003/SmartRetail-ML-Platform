"use client";

import { useEffect, useState, useRef } from "react";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch } from "@/lib/api";

export default function AdminOverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSeasonalDebug, setShowSeasonalDebug] = useState(false); // <-- added debug state

  // canvas refs
  const forecastRef = useRef(null);
  const inventoryRef = useRef(null);
  const pricingRef = useRef(null);
  const recoRef = useRef(null);
  const segRef = useRef(null);
  const seasonalRef = useRef(null); // <-- added for seasonal trends
  const salesForecastRef = useRef(null); // <-- added for sales forecast trend

  // store chart instances for cleanup
  const chartsRef = useRef({});

  // ensure theme applied for CSS [data-theme="light"]
  useEffect(() => {
    try {
      const theme = localStorage.getItem("adminTheme") || localStorage.getItem("theme") || "dark";
      document.documentElement.setAttribute("data-theme", theme);
    } catch {}
  }, []);

  // load data from backend endpoints
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      window.location.href = "/login/admin_login";
      return;
    }

    async function loadAll() {
      setLoading(true);
      setError("");
      try {
        const [
          forecastRes,
          inventoryRes,
          pricingRes,
          recoRes,
          segRes,
          seasonalRes,
          seasonalForecastRes,
        ] = await Promise.all([
          apiFetch("/api/ml/forecasting/overview/"),
          apiFetch("/api/ml/inventory/overview/"),
          apiFetch("/api/ml/pricing/overview/"),
          apiFetch("/api/ml/recommendation/overview/"),
          apiFetch("/api/ml/segmentation/overview/"),
          apiFetch("/api/ml/seasonal/overview/"),
          apiFetch("/api/ml/seasonal/predictions/?horizon_days=10"),
        ]);

        const combined = {
          forecasting: forecastRes.ok ? forecastRes.data : {},
          inventory: inventoryRes.ok ? inventoryRes.data : {},
          pricing: pricingRes.ok ? pricingRes.data : {},
          recommendations: recoRes.ok ? recoRes.data : {},
          segmentation: segRes.ok ? segRes.data : {},
          seasonal: seasonalRes.ok ? seasonalRes.data : {},
          seasonalForecast: seasonalForecastRes.ok ? seasonalForecastRes.data : {},
        };

        setData(combined);

        // if none of them returned OK, show error
        if (
          !forecastRes.ok &&
          !inventoryRes.ok &&
          !pricingRes.ok &&
          !recoRes.ok &&
          !segRes.ok &&
          !seasonalRes.ok
        ) {
          setError("Failed to load overview data from server.");
        }
      } catch (err) {
        setError(err?.message || "Unknown error while loading overview data");
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  // dynamic Chart.js loader
  async function ensureChartJs() {
    if (typeof window === "undefined") return null;
    if (window.Chart) return window.Chart;
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
      s.onload = () => resolve(window.Chart);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // create charts when data available
  useEffect(() => {
    if (loading || !data) return;

    let mounted = true;

    (async () => {
      try {
        const Chart = await ensureChartJs();
        if (!mounted || !Chart) return;

        // cleanup old charts
        Object.values(chartsRef.current).forEach((c) => c?.destroy?.());
        chartsRef.current = {};

        // Sales Forecast Trend chart (Actual + Predicted)
        try {
          const labels = data?.forecasting?.series?.labels || [];
          const predicted = data?.forecasting?.series?.predicted || [];
          const actual = data?.forecasting?.series?.actual || [];
          
          console.debug("Sales Forecast Data:", { labels: labels.length, predicted: predicted.length, actual: actual.length });
          
          const ctx = salesForecastRef.current?.getContext("2d");
          if (ctx && labels.length > 0) {
            chartsRef.current.salesForecast = new Chart(ctx, {
              type: "line",
              data: {
                labels,
                datasets: [
                  {
                    label: "Actual Sales (₹)",
                    data: actual,
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(59,130,246,0.12)",
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: "#3b82f6",
                  },
                  {
                    label: "Predicted Sales (₹)",
                    data: predicted,
                    borderColor: "#7c3aed",
                    backgroundColor: "rgba(124,58,237,0.12)",
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: "#7c3aed",
                  },
                ],
              },
              options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                  legend: { 
                    display: true,
                    position: "top",
                  },
                },
                scales: {
                  y: { beginAtZero: false },
                },
              },
            });
          } else {
            console.warn("Sales Forecast: Missing ctx or labels");
          }
        } catch (e) {
          console.error("Sales Forecast chart error:", e);
        }

        // Inventory risk bar chart
        try {
          const inv = data?.inventory || {};
          const labels = ["High", "Medium", "Low"];
          const vals = [inv.high_risk || 0, inv.medium_risk || 0, inv.low_risk || 0];
          const ctx = inventoryRef.current?.getContext("2d");
          if (ctx) {
            chartsRef.current.inventory = new Chart(ctx, {
              type: "bar",
              data: {
                labels,
                datasets: [
                  {
                    label: "Products",
                    data: vals,
                    backgroundColor: ["#ef4444", "#f7c945", "#22c55e"],
                  },
                ],
              },
              options: { responsive: true, maintainAspectRatio: false },
            });
          }
        } catch (e) {}

        // Pricing acceptance donut
        try {
          const acceptance = Math.min(100, data?.pricing?.acceptance_rate || 0);
          const ctx = pricingRef.current?.getContext("2d");
          if (ctx) {
            chartsRef.current.pricing = new Chart(ctx, {
              type: "doughnut",
              data: { labels: ["Accepted", "Remaining"], datasets: [{ data: [acceptance, 100 - acceptance], backgroundColor: ["#6246ea", "#eef2ff"] }] },
              options: { responsive: true, maintainAspectRatio: false },
            });
          }
        } catch (e) {}

        // Recommendations bar
        try {
          const reco = data?.recommendations || {};
          const labels = ["Active Products", "Interactions", "Orders"];
          const vals = [reco.active_products || 0, reco.total_interactions || 0, reco.total_orders || 0];
          const ctx = recoRef.current?.getContext("2d");
          if (ctx) {
            chartsRef.current.reco = new Chart(ctx, {
              type: "bar",
              data: { labels, datasets: [{ data: vals, backgroundColor: ["#6246ea", "#54e1ff", "#7c3aed"] }] },
              options: { responsive: true, maintainAspectRatio: false },
            });
          }
        } catch (e) {}

        // Segmentation pie
        try {
          const segObj = data?.segmentation?.segments || {};
          const labels = Object.keys(segObj || {}).map((k) => String(k));
          const vals = labels.map((k) => {
            const v = segObj[k];
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
          });

          const ctx = segRef.current?.getContext("2d");
          try { chartsRef.current.seg?.destroy?.(); } catch (e) {}

          if (!ctx) {
            console.warn("Segmentation canvas not ready");
          } else if (!labels.length) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted')?.trim() || '#9ca3af';
            ctx.font = "14px Inter, Arial";
            ctx.textAlign = "center";
            ctx.fillText("No segmentation data", ctx.canvas.width / 2, ctx.canvas.height / 2);
          } else {
            const total = vals.reduce((s, x) => s + x, 0);
            const safeVals = total === 0 ? labels.map(() => 1) : vals;
            const colorPool = labels.map((_, i) => `hsl(${(i * 60) % 360} 75% 55%)`);

            chartsRef.current.seg = new Chart(ctx, {
              type: "pie",
              data: { labels, datasets: [{ data: safeVals, backgroundColor: colorPool }] },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted')?.trim() || '#9ca3af' }
                  }
                }
              }
            });

            // allow DOM to settle then force resize
            setTimeout(() => {
              try { chartsRef.current.seg?.resize?.(); } catch (e) {}
            }, 20);
          }
        } catch (e) {
          console.warn("Segmentation chart error:", e);
        }

        // Seasonal trends chart - use daily_forecast from predictions endpoint
        try {
          const ctxSeason = seasonalRef.current?.getContext("2d");
          try { chartsRef.current.seasonal?.destroy?.(); } catch (e) {}

          if (ctxSeason) {
            const seasonalForecast = Array.isArray(data?.seasonalForecast?.forecast) 
              ? data.seasonalForecast.forecast 
              : [];

            console.debug("Seasonal Forecast Data:", { forecastLength: seasonalForecast.length, data: seasonalForecast.slice(0, 3) });

            if (seasonalForecast.length > 0) {
              const forecastLabels = seasonalForecast.map(s => 
                s.ds ? new Date(s.ds).toLocaleDateString() : "—"
              );
              const predicted = seasonalForecast.map(s => Number(s.yhat || 0));
              const upper = seasonalForecast.map(s => Number(s.yhat_upper || 0));
              const lower = seasonalForecast.map(s => Number(s.yhat_lower || 0));

              chartsRef.current.seasonal = new Chart(ctxSeason, {
                type: "line",
                data: {
                  labels: forecastLabels,
                  datasets: [
                    {
                      label: "Predicted Revenue",
                      data: predicted,
                      borderColor: "#7c3aed",
                      backgroundColor: "rgba(124,58,237,0.1)",
                      fill: true,
                      tension: 0.4,
                      pointRadius: 5,
                      pointBackgroundColor: "#7c3aed",
                      borderWidth: 2,
                    },
                    {
                      label: "Upper Bound",
                      data: upper,
                      borderColor: "#22c55e",
                      borderDash: [5, 5],
                      fill: false,
                      tension: 0.4,
                      pointRadius: 3,
                      borderWidth: 2,
                    },
                    {
                      label: "Lower Bound",
                      data: lower,
                      borderColor: "#ef4444",
                      borderDash: [5, 5],
                      fill: false,
                      tension: 0.4,
                      pointRadius: 3,
                      borderWidth: 2,
                    },
                  ],
                },
                options: { 
                  responsive: true, 
                  maintainAspectRatio: false,
                  plugins: { 
                    legend: { 
                      display: true,
                      position: "top",
                    } 
                  },
                  scales: {
                    y: { beginAtZero: false },
                  },
                },
              });

              // ensure visible redraw
              setTimeout(() => {
                try { chartsRef.current.seasonal?.resize?.(); } catch (e) {}
              }, 30);
            } else {
              console.warn("Seasonal: No forecast data available");
            }
          }
        } catch (e) {
          console.error("Seasonal chart error:", e);
        }
      } catch (err) {
        // Chart load failed; still show data
        console.warn("Chart load failed", err);
      }
    })();

    return () => {
      mounted = false;
      Object.values(chartsRef.current).forEach((c) => c?.destroy?.());
      chartsRef.current = {};
    };
  }, [loading, data]);

  if (loading) {
    return (
      <div className="app-page">
        <AdminSidebar active="admin_overview" />
        <main className="page">
          <div className="reportPanel">Loading overview…</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page">
        <AdminSidebar active="admin_overview" />
        <main className="page">
          <div className="alertBox" style={{ borderLeftColor: "#ef4444", background: "rgba(239,68,68,0.06)" }}>
            {error}
          </div>
        </main>
      </div>
    );
  }

  // Render full overview with charts + KPIs + raw JSON for verification
  return (
    <div className="app-page">
      <AdminSidebar active="admin_overview" />

      <main className="page">
        <h1 className="pageTitle">Analytics Overview</h1>
        <p className="pageSubtitle">System performance & insights snapshot</p>

        {/* KPI Summary Grid */}
        <div className="summaryGrid">
          <div className="reportPanel">
            <div className="kpiHeader">Forecast</div>
            <div className="kpiGrid">
              <div className="kpiItem">
                <div className="kpiLabel">Next Month</div>
                <div className="kpiValue">₹{Number(data?.forecasting?.forecast_next_month ?? 0).toLocaleString()}</div>
              </div>
              <div className="kpiItem">
                <div className="kpiLabel">Confidence</div>
                <div className="kpiValue">{Math.round((data?.forecasting?.confidence_score ?? 0) * 100)}%</div>
              </div>
            </div>
          </div>

          <div className="reportPanel">
            <div className="kpiHeader">Inventory</div>
            <div className="kpiGrid">
              <div className="kpiItem">
                <div className="kpiLabel">Total Products</div>
                <div className="kpiValue">{data?.inventory?.total_products ?? "—"}</div>
              </div>
              <div className="kpiItem">
                <div className="kpiLabel">Reorder Needed</div>
                <div className="kpiValue">{data?.inventory?.total_reorder_needed ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="reportPanel">
            <div className="kpiHeader">Pricing</div>
            <div className="kpiGrid">
              <div className="kpiItem">
                <div className="kpiLabel">Optimized Prices</div>
                <div className="kpiValue">{data?.pricing?.optimized_prices ?? "—"}</div>
              </div>
              <div className="kpiItem">
                <div className="kpiLabel">Acceptance</div>
                <div className="kpiValue">{(data?.pricing?.acceptance_rate ?? 0).toFixed(1)}%</div>
              </div>
            </div>
          </div>

          <div className="reportPanel">
            <div className="kpiHeader">Recommendations</div>
            <div className="kpiGrid">
              <div className="kpiItem">
                <div className="kpiLabel">Active Products</div>
                <div className="kpiValue">{data?.recommendations?.active_products ?? "—"}</div>
              </div>
              <div className="kpiItem">
                <div className="kpiLabel">Total Interactions</div>
                <div className="kpiValue">{data?.recommendations?.total_interactions ?? "—"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="reportPanel">
          <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>📈 Sales Forecast Trend</h3>
          <div style={{ height: 260 }}>
            <canvas ref={salesForecastRef} />
          </div>
        </div>

        <div className="chartsGrid">
          <div className="reportPanel">
            <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>📊 Inventory Risk Distribution</h3>
            <div style={{ height: 200 }}>
              <canvas ref={inventoryRef} />
            </div>
          </div>

          <div className="reportPanel">
            <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>💰 Pricing Acceptance Rate</h3>
            <div style={{ height: 200 }}>
              <canvas ref={pricingRef} />
            </div>
          </div>
        </div>

        <div className="chartsGrid">
          <div className="reportPanel">
            <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>🎯 Recommendations Summary</h3>
            <div style={{ height: 200 }}>
              <canvas ref={recoRef} />
            </div>
          </div>

          <div className="reportPanel">
            <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>👥 Customer Segmentation</h3>
            <div style={{ height: 200 }}>
              <canvas ref={segRef} style={{ width: "100%", height: "100%" }} />
            </div>
          </div>
        </div>

        {/* Seasonal Trends visualization */}
        <div className="reportPanel">
          <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>� 10-Day Forecast</h3>
          <div style={{ height: 260 }}>
            <canvas ref={seasonalRef} style={{ width: "100%", height: "100%" }} />
          </div>
          {/* Debug toggle — shows raw seasonal JSON to help verify backend payload */}
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={() => setShowSeasonalDebug((s) => !s)} style={{ fontSize: 12, padding: "6px 10px" }}>
              {showSeasonalDebug ? "Hide" : "Show"} seasonal JSON
            </button>
            {showSeasonalDebug && (
              <pre style={{ marginTop: 8, maxHeight: 200, overflow: "auto", background: "rgba(0,0,0,0.5)", padding: 10 }}>
                {JSON.stringify(data?.seasonal, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Inventory Details Table */}
        {data?.inventory && (
          <div className="reportPanel">
            <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>📦 Inventory Details</h3>
            <div className="tableWrapper">
              <table className="table">
                <tbody>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                  </tr>
                  <tr>
                    <td>Total Products</td>
                    <td><strong>{data.inventory.total_products ?? "—"}</strong></td>
                  </tr>
                  <tr>
                    <td>High Risk (7 days)</td>
                    <td style={{ color: "#ef4444" }}><strong>{data.inventory.high_risk ?? 0}</strong></td>
                  </tr>
                  <tr>
                    <td>Medium Risk (7-20 days)</td>
                    <td style={{ color: "#f7c945" }}><strong>{data.inventory.medium_risk ?? 0}</strong></td>
                  </tr>
                  <tr>
                    <td>Low Risk (20+ days)</td>
                    <td style={{ color: "#22c55e" }}><strong>{data.inventory.low_risk ?? 0}</strong></td>
                  </tr>
                  <tr>
                    <td>Total Stock Units</td>
                    <td><strong>{data.inventory.total_stock ?? 0}</strong></td>
                  </tr>
                  <tr>
                    <td>Reorder Needed</td>
                    <td><strong>{data.inventory.total_reorder_needed ?? 0}</strong></td>
                  </tr>
                  <tr>
                    <td>Avg Days Supply</td>
                    <td><strong>{(data.inventory.avg_days_supply ?? 0).toFixed(1)} days</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
            {data.inventory.insights && (
              <div className="insightsBox">
                <h4 style={{ marginBottom: "12px", color: "var(--accent)" }}>💡 Insights</h4>
                {data.inventory.insights.map((insight, idx) => (
                  <div key={idx} className="insightItem">{insight}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Segmentation Details */}
        {data?.segmentation && (
          <div className="reportPanel">
            <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>👥 Customer Segmentation Breakdown</h3>
            <div className="tableWrapper">
              <table className="table">
                <tbody>
                  <tr>
                    <th>Segment</th>
                    <th>Count</th>
                    <th>Percentage</th>
                  </tr>
                  {data.segmentation.segments &&
                    Object.entries(data.segmentation.segments).map(([segment, count]) => {
                      const total = Object.values(data.segmentation.segments || {}).reduce((a, b) => a + Number(b || 0), 0);
                      const pct = total === 0 ? "0.0" : ((Number(count || 0) / total) * 100).toFixed(1);
                       return (
                         <tr key={segment}>
                           <td><strong>{segment}</strong></td>
                           <td>{count}</td>
                           <td>
                             <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                               <div style={{ background: "var(--accent)", width: `${Number(pct) * 2}px`, height: "6px", borderRadius: "3px" }}></div>
                               {pct}%
                             </div>
                           </td>
                         </tr>
                       );
                     })}
                </tbody>
              </table>
            </div>
            {data.segmentation.insights && (
              <div className="insightsBox">
                <h4 style={{ marginBottom: "12px", color: "var(--accent)" }}>💡 Insights</h4>
                {data.segmentation.insights.map((insight, idx) => (
                  <div key={idx} className="insightItem">{insight}</div>
                ))}
              </div>
            )}
            <div style={{ marginTop: "14px" }}>
              <strong>Total Customers:</strong> {data.segmentation.total_customers ?? "—"}
            </div>
          </div>
        )}

        {/* Pricing Summary */}
        {data?.pricing && (
          <div className="reportPanel">
            <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>💰 Dynamic Pricing Summary</h3>
            <div className="kpiGrid">
              <div className="kpiItem">
                <div className="kpiLabel">Optimized Prices</div>
                <div className="kpiValue">{data.pricing.optimized_prices ?? "—"}</div>
              </div>
              <div className="kpiItem">
                <div className="kpiLabel">Acceptance Rate</div>
                <div className="kpiValue">{(data.pricing.acceptance_rate ?? 0).toFixed(1)}%</div>
              </div>
              <div className="kpiItem">
                <div className="kpiLabel">Avg Discount</div>
                <div className="kpiValue">{(data.pricing.avg_discount ?? 0).toFixed(2)}%</div>
              </div>
              <div className="kpiItem">
                <div className="kpiLabel">Revenue Gain</div>
                <div className="kpiValue">₹{Number(data.pricing.revenue_gain ?? 0).toLocaleString()}</div>
              </div>
            </div>
            {data.pricing.insights && (
              <div className="insightsBox" style={{ marginTop: "16px" }}>
                <h4 style={{ marginBottom: "12px", color: "var(--accent)" }}>💡 Insights</h4>
                {data.pricing.insights.map((insight, idx) => (
                  <div key={idx} className="insightItem">{insight}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recommendations Status */}
        {data?.recommendations && (
          <div className="reportPanel">
            <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>🎯 Recommendation Engine Status</h3>
            <div className="tableWrapper">
              <table className="table">
                <tbody>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                  </tr>
                  <tr>
                    <td>Active Products</td>
                    <td><strong>{data.recommendations.active_products ?? "—"}</strong></td>
                  </tr>
                  <tr>
                    <td>Total Interactions</td>
                    <td><strong>{data.recommendations.total_interactions ?? "—"}</strong></td>
                  </tr>
                  <tr>
                    <td>Total Orders</td>
                    <td><strong>{data.recommendations.total_orders ?? "—"}</strong></td>
                  </tr>
                  <tr>
                    <td>Model Type</td>
                    <td><strong>{data.recommendations.model_type ?? "Co-purchase"}</strong></td>
                  </tr>
                  <tr>
                    <td>Status</td>
                    <td>
                      <span className="status-badge" style={{ background: "rgba(34,197,94,0.16)", color: "#22c55e" }}>
                        {data.recommendations.status ?? "LIVE"}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Seasonal Trends */}
        {data?.seasonal && (
          <div className="reportPanel">
            <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>📅 Seasonal Trends</h3>
            <div className="tableWrapper">
              <table className="table">
                <tbody>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                  </tr>
                  <tr>
                    <td>Model Available</td>
                    <td>
                      <span className="status-badge" style={{ background: data.seasonal.has_model ? "rgba(34,197,94,0.16)" : "rgba(239,68,68,0.16)", color: data.seasonal.has_model ? "#22c55e" : "#ef4444" }}>
                        {data.seasonal.has_model ? "✓ Yes" : "✗ No"}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Total Products</td>
                    <td><strong>{data.seasonal.total_products ?? "—"}</strong></td>
                  </tr>
                  <tr>
                    <td>Last Trained</td>
                    <td><strong>{data.seasonal.last_trained_at ? new Date(data.seasonal.last_trained_at).toLocaleDateString() : "—"}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
