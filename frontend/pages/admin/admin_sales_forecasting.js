"use client";

import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch } from "@/lib/api";

export default function AdminSalesForecastingPage() {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState("");
  const [showForecastDebug, setShowForecastDebug] = useState(false);
  const [training, setTraining] = useState(false);

  /* =========================
     LOAD FORECAST DATA
  ========================= */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      window.location.href = "/login/admin_login";
      return;
    }
    loadForecast();
  }, []);

  async function loadForecast() {
    setLoading(true);
    setError("");

    const res = await apiFetch("/api/ml/forecasting/overview/");
    if (!res.ok) {
      console.error("Forecast API error:", res);
      setError(res?.error || res?.statusText || "Failed to load sales forecast");
      setLoading(false);
      return;
    }

    const raw = res.data || {};
    console.debug("forecast raw payload:", raw);

    /* ✅ NORMALIZE DATA (CRITICAL FIX) */
    setForecast({
      forecast_next_month: Number(raw.forecast_next_month ?? 0),
      confidence_score: Number(raw.confidence_score ?? 0),
      period_label: raw.period_label ?? "—",
      model_name: raw.model_name ?? "—",
      last_trained_at: raw.last_trained_at ?? null,

      series: {
        labels: Array.isArray(raw.series?.labels) ? raw.series.labels : (Array.isArray(raw.labels) ? raw.labels : []),
        actual: Array.isArray(raw.series?.actual) ? raw.series.actual.map((v) => Number(v) || 0) : (Array.isArray(raw.actual) ? raw.actual.map((v)=>Number(v)||0) : []),
        predicted: Array.isArray(raw.series?.predicted) ? raw.series.predicted.map((v) => Number(v) || 0) : (Array.isArray(raw.predicted) ? raw.predicted.map((v)=>Number(v)||0) : []),
      },

      metrics: {
        mae: raw.metrics?.mae ?? null,
        rmse: raw.metrics?.rmse ?? null,
        r2: raw.metrics?.r2 ?? null,
      },
    });

    setLoading(false);
  }

  async function triggerTrain() {
    setTraining(true);
    setError("");
    try {
      const res = await apiFetch("/api/ml/forecasting/recompute/", { method: "POST" });
      if (!res.ok) {
        setError(res?.data?.detail || `Train failed (status ${res.status})`);
      } else {
        // refresh forecast after retraining
        await loadForecast();
      }
    } catch (e) {
      console.error("Train error:", e);
      setError("Training request failed");
    } finally {
      setTraining(false);
    }
  }

  /* =========================
     RENDER CHART
  ========================= */
  useEffect(() => {
    if (!forecast || !chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    chartInstance.current = new Chart(chartRef.current, {
      type: "line",
      data: {
        labels: forecast.series.labels,
        datasets: [
          {
            label: "Actual Sales (₹)",
            data: forecast.series.actual,
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
            data: forecast.series.predicted,
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

    return () => chartInstance.current?.destroy();
  }, [forecast]);

  /* =========================
     UI STATES
  ========================= */
  if (loading) {
    return (
      <div className="app-page">
        <AdminSidebar active="admin_sales_forecasting" />
        <main className="main">
          <div className="card">Loading sales forecast…</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page">
        <AdminSidebar active="admin_sales_forecasting" />
        <main className="main">
          <div className="errorText">{error}</div>
        </main>
      </div>
    );
  }

  /* =========================
     MAIN RENDER
  ========================= */
  return (
    <div className="app-page">
      <AdminSidebar active="admin_sales_forecasting" />

      <main className="main">
        <h1 className="pageTitle">Sales Forecasting</h1>
        <p className="pageSubtitle">
          Time-series forecasting powered by ML (automation-aware)
        </p>

        {/* ================= SUMMARY ================= */}
        <div className="summaryGrid force4">
          <div className="card">
            <div className="labelPill">Next Period Forecast</div>
            <div className="value">₹{forecast.forecast_next_month}</div>
          </div>

          <div className="card">
            <div className="labelPill">Confidence Score</div>
            <div className="value">
              {(forecast.confidence_score * 100).toFixed(1)}%
            </div>
          </div>

          <div className="card">
            <div className="labelPill">Forecast Window</div>
            <div className="value">{forecast.period_label}</div>
          </div>

          <div className="card">
            <div className="labelPill">Train Model</div>
            <div className="value">
              <button
                type="button"
                className="btn primary"
                onClick={triggerTrain}
                disabled={training}
              >
                {training ? "Training…" : "Train Now"}
              </button>
            </div>
          </div>
        </div>

        {/* ================= CHART ================= */}
        <div className="card">
          <h3 className="cardTitle">Sales Forecast Trend</h3>
          <div style={{ height: 360 }}>
            <canvas ref={chartRef} />
          </div>
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn secondary" onClick={() => setShowForecastDebug((s) => !s)} style={{ fontSize: 12 }}>
              {showForecastDebug ? "Hide" : "Show"} raw forecast JSON
            </button>
            {showForecastDebug && (
              <pre style={{ marginTop: 8, maxHeight: 220, overflow: "auto", background: "rgba(0,0,0,0.45)", padding: 10 }}>
                {JSON.stringify(forecast || {}, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* ================= MODEL METRICS + ML NOTES SIDE BY SIDE ================= */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 16 }}>
          <div className="card">
            <h3 className="cardTitle">Model Performance</h3>

            <div className="grid-3">
              <div>
                <b>MAE</b>
                <p>
                  {forecast.metrics.mae !== null
                    ? `₹${forecast.metrics.mae}`
                    : "—"}
                </p>
              </div>

              <div>
                <b>RMSE</b>
                <p>
                  {forecast.metrics.rmse !== null
                    ? `₹${forecast.metrics.rmse}`
                    : "—"}
                </p>
              </div>

              <div>
                <b>R² Score</b>
                <p>
                  {forecast.metrics.r2 !== null
                    ? forecast.metrics.r2
                    : "—"}
                </p>
              </div>
            </div>

            <p className="muted" style={{ marginTop: 8 }}>
              Last trained:{" "}
              {forecast.last_trained_at
                ? new Date(forecast.last_trained_at).toLocaleString()
                : "—"}
            </p>
          </div>

          <div className="card">
            <h3 className="cardTitle">ML Notes</h3>
            <p className="automation-note">
              Current model: <b>{forecast.model_name}</b>
              <br />
              Automation Center controls retraining & inference.
              <br />
              Cached predictions are used when automation is OFF.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
