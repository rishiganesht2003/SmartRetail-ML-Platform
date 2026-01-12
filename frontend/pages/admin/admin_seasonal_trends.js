"use client";

import { useEffect, useState, useRef } from "react";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch } from "@/lib/api";

export default function AdminSeasonalTrendsPage() {
  const [overview, setOverview] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState("");
  const chartRef = useRef(null);

  // Ensure the document root has the correct theme (so CSS [data-theme="light"] works)
  useEffect(() => {
    try {
      const theme =
        localStorage.getItem("adminTheme") ||
        localStorage.getItem("theme") ||
        "dark";
      document.documentElement.setAttribute("data-theme", theme);
    } catch (e) {
      // silent
    }
  }, []);

  /* =========================
     LOAD DATA
  ========================= */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      window.location.href = "/login/admin_login";
      return;
    }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    const [ov, fc] = await Promise.all([
      apiFetch("/api/ml/seasonal/overview/"),
      apiFetch("/api/ml/seasonal/predictions/?horizon_days=10"),
    ]);

    if (!ov.ok || !fc.ok) {
      setError("Failed to load seasonal trends data");
      setLoading(false);
      return;
    }

    /* ✅ NORMALIZE DATA (CRITICAL) */
    setOverview({
      has_model: ov.data?.has_model ?? false,
      total_products: ov.data?.total_products ?? 0,
      last_trained_at: ov.data?.last_trained_at ?? null,
    });

    setForecast(Array.isArray(fc.data?.forecast) ? fc.data.forecast : []);

    setLoading(false);
  }

  /* =========================
     RECOMPUTE
  ========================= */
  async function handleRecompute() {
    if (!confirm("Recompute seasonal forecast model?")) return;

    setRecomputing(true);

    const res = await apiFetch("/api/ml/seasonal/recompute/", {
      method: "POST",
      body: { horizon_days: 365 },
    });

    if (!res.ok) {
      alert("Recompute failed");
    } else {
      alert("Seasonal model recomputed");
      await loadData();
    }

    setRecomputing(false);
  }

  /* =========================
     PEAK MONTH CALC (SAFE)
  ========================= */
  let peakMonth = "—";

  if (forecast.length) {
    const byMonth = {};

    forecast.forEach((p) => {
      if (!p?.ds || p?.yhat == null) return;
      const d = new Date(p.ds);
      const key = `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}`;
      byMonth[key] = (byMonth[key] || 0) + Number(p.yhat || 0);
    });

    peakMonth =
      Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  }

  /* =========================
     CHART RENDERING
  ========================= */
  useEffect(() => {
    if (!forecast.length || !chartRef.current) return;

    (async () => {
      // Dynamically load Chart.js
      if (!window.Chart) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
        script.onload = renderChart;
        document.head.appendChild(script);
      } else {
        renderChart();
      }
    })();

    function renderChart() {
      const labels = forecast.map((p) =>
        p.ds ? new Date(p.ds).toLocaleDateString() : "—"
      );
      const predicted = forecast.map((p) => Number(p.yhat || 0));
      const lower = forecast.map((p) => Number(p.yhat_lower || 0));
      const upper = forecast.map((p) => Number(p.yhat_upper || 0));

      const ctx = chartRef.current?.getContext("2d");
      if (!ctx) return;

      // Destroy previous chart if it exists
      if (window.seasonalChart) {
        window.seasonalChart.destroy();
      }

      window.seasonalChart = new window.Chart(ctx, {
        type: "line",
        data: {
          labels,
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
            },
            {
              label: "Upper Bound",
              data: upper,
              borderColor: "#22c55e",
              borderDash: [5, 5],
              fill: false,
              tension: 0.4,
              pointRadius: 3,
            },
            {
              label: "Lower Bound",
              data: lower,
              borderColor: "#ef4444",
              borderDash: [5, 5],
              fill: false,
              tension: 0.4,
              pointRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              position: "top",
            },
          },
          scales: {
            y: {
              beginAtZero: false,
            },
          },
        },
      });
    }
  }, [forecast]);

  /* =========================
     UI STATES
  ========================= */
  if (loading) {
    return (
      <div className="app-page">
        <AdminSidebar active="admin_seasonal_trends" />
        <main className="page">
          <div className="card">Loading seasonal trends…</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page">
        <AdminSidebar active="admin_seasonal_trends" />
        <main className="page">
          <div className="errorText">{error}</div>
        </main>
      </div>
    );
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="app-page">
      <AdminSidebar active="admin_seasonal_trends" />

      <main className="page">
        <h1 className="pageTitle">Seasonal Trends</h1>
        <p className="pageSubtitle">
          Forecasted demand patterns from historical sales
        </p>

        {/* ================= TOP METRICS ================= */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '18px',
          marginBottom: '28px'
        }}>
          {/* Card 1: Model Status */}
          <div className="card reportPanel" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '140px'
          }}>
            <div>
              <div className="labelPill">Model Status</div>
              <div className="value" style={{ marginTop: '12px', marginBottom: '8px' }}>
                {overview.has_model ? "Cached Model" : "No Model"}
              </div>
            </div>
            <div className="muted" style={{ fontSize: '12px', marginTop: '8px' }}>
              {overview.last_trained_at
                ? new Date(overview.last_trained_at).toLocaleString()
                : "—"}
            </div>
          </div>

          {/* Card 2: Products */}
          <div className="card reportPanel">
            <div className="labelPill">Products</div>
            <div className="value" style={{ marginTop: '12px' }}>
              {overview.total_products}
            </div>
          </div>

          {/* Card 3: Peak Month */}
          <div className="card reportPanel">
            <div className="labelPill">Peak Month</div>
            <div className="value" style={{ marginTop: '12px' }}>
              {peakMonth}
            </div>
          </div>

          {/* Card 4: Actions */}
          <div className="card reportPanel" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '140px'
          }}>
            <div className="labelPill">Actions</div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '12px'
            }}>
              <button
                className="btn primary"
                onClick={handleRecompute}
                disabled={recomputing}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                {recomputing ? "Training…" : "Recompute"}
              </button>
              <button 
                className="btn secondary" 
                onClick={loadData}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ================= FORECAST CHART ================= */}
        <div className="card reportPanel" style={{ marginTop: 16 }}>
          <h3 className="cardTitle">10-Day Forecast Chart</h3>
          <canvas
            ref={chartRef}
            style={{
              maxHeight: "350px",
              marginBottom: "16px",
            }}
          ></canvas>
        </div>

        {/* ================= FORECAST TABLE ================= */}
        <div className="card reportPanel" style={{ marginTop: 16 }}>
          <h3 className="cardTitle">Next 10 Days Forecast</h3>

          <div className="tableWrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Predicted</th>
                  <th>Lower</th>
                  <th>Upper</th>
                </tr>
              </thead>
              <tbody>
                {forecast.slice(0, 10).map((p, i) => (
                  <tr key={i}>
                    <td>
                      {p.ds ? new Date(p.ds).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      ₹{p.yhat != null ? Number(p.yhat).toFixed(2) : "—"}
                    </td>
                    <td>
                      ₹
                      {p.yhat_lower != null
                        ? Number(p.yhat_lower).toFixed(2)
                        : "—"}
                    </td>
                    <td>
                      ₹
                      {p.yhat_upper != null
                        ? Number(p.yhat_upper).toFixed(2)
                        : "—"}
                    </td>
                  </tr>
                ))}

                {!forecast.length && (
                  <tr>
                    <td colSpan={4} className="center">
                      No forecast data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= ML NOTE ================= */}
        <div className="card reportPanel" style={{ marginTop: 16 }}>
          <h3 className="cardTitle">ML Notes</h3>
          <p className="automation-note">
            Seasonal model uses historical sales trends.
            <br />
            Automation Center controls retraining & inference.
            <br />
            Cached predictions are used when automation is OFF.
          </p>
        </div>
      </main>
    </div>
  );
}
