"use client";

import { useEffect, useState, useRef } from "react";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch, API_URL } from "@/lib/api";

export default function AdminReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // canvas refs for charts
  const forecastRef = useRef(null);
  const inventoryRef = useRef(null);
  const pricingRef = useRef(null);
  const recoRef = useRef(null);
  const seasonalRef = useRef(null);
  const segRef = useRef(null);

  const chartsRef = useRef({});

  // ensure theme applied
  useEffect(() => {
    try {
      const theme = localStorage.getItem("adminTheme") || localStorage.getItem("theme") || "dark";
      document.documentElement.setAttribute("data-theme", theme);
    } catch {}
  }, []);

  // load all data endpoints
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      window.location.href = "/login/admin_login";
      return;
    }

    async function loadReportsData() {
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

        if (
          !forecastRes.ok &&
          !inventoryRes.ok &&
          !pricingRes.ok &&
          !recoRes.ok &&
          !segRes.ok &&
          !seasonalRes.ok
        ) {
          setError("Failed to load reports data from server.");
        }
      } catch (err) {
        setError(err?.message || "Unknown error while loading reports");
      } finally {
        setLoading(false);
      }
    }

    loadReportsData();
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

  // Generate / download Power BI Template (.pbit) via backend API
  // Download combined JSON payload suitable for Power BI web connector
  async function downloadPowerBIJSON() {
    try {
      const resp = await fetch(`${API_URL}/api/ml/forecasting/overview/?powerbi=1`);
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const json = await resp.json();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smartretail_powerbi_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download Power BI JSON: " + (err?.message || err));
    }
  }

  // Download server-generated HTML report (self-contained visuals)
  async function downloadHTMLReport() {
    try {
      const resp = await fetch(`${API_URL}/api/ml/powerbi/report_html/`);
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SmartRetail_Reports_${new Date().toISOString().slice(0,10)}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download HTML report: " + (err?.message || err));
    }
  }

  // create all charts
  useEffect(() => {
    if (loading || !data) return;

    let mounted = true;

    (async () => {
      try {
        const Chart = await ensureChartJs();
        if (!mounted || !Chart) return;

        Object.values(chartsRef.current).forEach((c) => c?.destroy?.());
        chartsRef.current = {};

        // Forecast line chart (Actual + Predicted)
        try {
          const labels = data?.forecasting?.series?.labels || [];
          const predicted = data?.forecasting?.series?.predicted || [];
          const actual = data?.forecasting?.series?.actual || [];
          
          console.debug("Reports Forecast Data:", { labels: labels.length, predicted: predicted.length, actual: actual.length });
          
          const ctx = forecastRef.current?.getContext("2d");
          if (ctx && labels.length > 0) {
            chartsRef.current.forecast = new Chart(ctx, {
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
                  } 
                },
                scales: {
                  y: { beginAtZero: false },
                },
              },
            });
          }
        } catch (e) {
          console.error("Forecast chart error:", e);
        }

        // Inventory risk bar chart
        try {
          const inv = data?.inventory || {};
          const labels = ["High Risk", "Medium Risk", "Low Risk"];
          const vals = [inv.high_risk || 0, inv.medium_risk || 0, inv.low_risk || 0];
          const ctx = inventoryRef.current?.getContext("2d");
          if (ctx) {
            chartsRef.current.inventory = new Chart(ctx, {
              type: "bar",
              data: {
                labels,
                datasets: [
                  {
                    label: "Product Count",
                    data: vals,
                    backgroundColor: ["#ef4444", "#f7c945", "#22c55e"],
                    borderRadius: 8,
                  },
                ],
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } },
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
              data: {
                labels: ["Accepted", "Pending"],
                datasets: [
                  {
                    data: [acceptance, 100 - acceptance],
                    backgroundColor: ["#6246ea", "#e0d7ff"],
                    borderColor: ["#6246ea", "#e0d7ff"],
                  },
                ],
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } },
            });
          }
        } catch (e) {}

        // Recommendations bar
        try {
          const reco = data?.recommendations || {};
          const labels = ["Active\nProducts", "Total\nInteractions", "Total\nOrders"];
          const vals = [reco.active_products || 0, reco.total_interactions || 0, reco.total_orders || 0];
          const ctx = recoRef.current?.getContext("2d");
          if (ctx) {
            chartsRef.current.reco = new Chart(ctx, {
              type: "bar",
              data: {
                labels,
                datasets: [
                  {
                    label: "Count",
                    data: vals,
                    backgroundColor: ["#6246ea", "#54e1ff", "#7c3aed"],
                    borderRadius: 8,
                  },
                ],
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } },
            });
          }
        } catch (e) {}

        // Segmentation pie (robust)
        try {
          const segObj = data?.segmentation?.segments || {};
          // normalize labels and values
          const labels = Object.keys(segObj || {}).map((k) => String(k));
          const vals = labels.map((k) => {
            const v = segObj[k];
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
          });

          const ctx = segRef.current?.getContext("2d");
          try { chartsRef.current.seg?.destroy?.(); } catch (e) {}

          if (!ctx) {
            console.warn("Segmentation canvas not available yet");
          } else if (!labels.length) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--muted") || "#9ca3af";
            ctx.font = "14px Inter, Arial";
            ctx.textAlign = "center";
            ctx.fillText("No segmentation data", ctx.canvas.width / 2, ctx.canvas.height / 2);
          } else {
            const total = vals.reduce((s, x) => s + x, 0);
            const safeVals = total === 0 ? labels.map(() => 1) : vals;
            const defaultColors = ["#6246ea", "#54e1ff", "#22c55e", "#f7c945", "#ef4444", "#a78bfa", "#60a5fa", "#fb7185"];

            chartsRef.current.seg = new Chart(ctx, {
              type: "pie",
              data: {
                labels,
                datasets: [
                  {
                    data: safeVals,
                    backgroundColor: labels.map((_, i) => defaultColors[i % defaultColors.length]),
                    borderColor: "#0b1020",
                    borderWidth: 1,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
                    labels: {
                      boxWidth: 12,
                      padding: 12,
                      color: getComputedStyle(document.documentElement).getPropertyValue('--muted') || "#cbd5e1",
                    },
                  },
                },
              },
            });

            // ensure Chart redraw/rescale after insertion into DOM
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

            console.debug("Reports Seasonal Forecast Data:", { forecastLength: seasonalForecast.length, data: seasonalForecast.slice(0, 3) });

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
              console.warn("Reports Seasonal: No forecast data available");
            }
          }
        } catch (e) {
          console.error("Reports Seasonal chart error:", e);
        }
      } catch (err) {
        console.warn("Chart load failed", err);
      }
    })();

    return () => {
      mounted = false;
      Object.values(chartsRef.current).forEach((c) => c?.destroy?.());
      chartsRef.current = {};
    };
  }, [loading, data]);

  /* Helper: ensure ExcelJS is loaded on the page (UMD bundle exposes window.ExcelJS) */
  async function ensureExcelJs() {
    if (typeof window === "undefined") throw new Error("Not in browser");
    if (window.ExcelJS) return window.ExcelJS;
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/exceljs/dist/exceljs.min.js";
      s.onload = () => {
        // Some builds expose ExcelJS or ExcelJS.Workbook; normalize
        const Excel = window.ExcelJS || window.Excel;
        if (!Excel && !window.ExcelJS) {
          // try another bundle
          setTimeout(() => {
            if (window.ExcelJS) resolve(window.ExcelJS);
            else reject(new Error("ExcelJS not available after load"));
          }, 200);
          return;
        }
        resolve(window.ExcelJS || window.Excel || Excel);
      };
      s.onerror = (e) => reject(new Error("Failed to load ExcelJS: " + e?.message));
      document.head.appendChild(s);
    });
  }

  /* Export to real XLSX with embedded chart images using ExcelJS (browser) */
  async function exportToExcel() {
    // Ensure charts are rendered
    try {
      // Collect base64 images from canvases
      const canvases = [
        forecastRef,
        inventoryRef,
        pricingRef,
        recoRef,
        segRef,
        seasonalRef
      ];
      const imgs = canvases.map((ref) => {
        try {
          const c = ref?.current;
          return c ? c.toDataURL("image/png") : null;
        } catch {
          return null;
        }
      });

      // Load ExcelJS
      const ExcelJS = await ensureExcelJs();

      // Create workbook
      const workbook = new (ExcelJS.Workbook || ExcelJS.Workbook)();
      workbook.creator = "SmartRetail";
      workbook.created = new Date();

      // Utility to add a worksheet with headers and rows
      function addTableSheet(name, headers, rows) {
        const ws = workbook.addWorksheet(name);
        ws.properties.defaultColWidth = 20;
        ws.addRow(headers);
        // style header row
        const headerRow = ws.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.alignment = { vertical: "middle", horizontal: "left" };
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF6246EA" },
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });

        rows.forEach((r) => {
          ws.addRow(r);
        });

        // Auto width (simple)
        ws.columns.forEach((col) => {
          let maxLength = 10;
          col.eachCell({ includeEmpty: true }, (cell) => {
            const v = cell.value ? String(cell.value) : "";
            if (v.length > maxLength) maxLength = v.length;
          });
          col.width = Math.min(Math.max(maxLength + 4, 12), 60);
        });

        return ws;
      }

      // Prepare datasets
      const forecasting = data?.forecasting || {};
      const inventory = data?.inventory || {};
      const pricing = data?.pricing || {};
      const recommendations = data?.recommendations || {};
      const segmentation = data?.segmentation || {};
      const seasonal = data?.seasonal || {};

      // Forecast sheet (overview + series if present)
      addTableSheet("Forecast Overview", ["Metric", "Value"], [
        ["Next Month Forecast", forecasting.forecast_next_month ?? ""],
        ["Confidence Score", forecasting.confidence_score ?? ""],
      ]);
      if (Array.isArray(forecasting.series?.labels) && forecasting.series.labels.length) {
        const ws = addTableSheet("Forecast Series", ["Label", "Value"], forecasting.series.labels.map((lbl, idx) => [lbl, forecasting.series.predicted?.[idx] ?? ""]));
        // reserve space for chart image later near top
      }

      // Inventory sheet
      addTableSheet("Inventory Overview", ["Metric", "Value"], [
        ["Total Products", inventory.total_products ?? ""],
        ["High Risk", inventory.high_risk ?? 0],
        ["Medium Risk", inventory.medium_risk ?? 0],
        ["Low Risk", inventory.low_risk ?? 0],
        ["Total Stock", inventory.total_stock ?? 0],
        ["Avg Days Supply", inventory.avg_days_supply ?? 0],
        ["Reorder Needed", inventory.total_reorder_needed ?? 0],
      ]);

      // Pricing sheet
      addTableSheet("Pricing Overview", ["Metric", "Value"], [
        ["Optimized Prices", pricing.optimized_prices ?? ""],
        ["Acceptance Rate", pricing.acceptance_rate ?? ""],
        ["Avg Discount", pricing.avg_discount ?? ""],
        ["Revenue Gain", pricing.revenue_gain ?? ""],
      ]);

      // Recommendations sheet
      addTableSheet("Recommendations Overview", ["Metric", "Value"], [
        ["Active Products", recommendations.active_products ?? 0],
        ["Total Interactions", recommendations.total_interactions ?? 0],
        ["Total Orders", recommendations.total_orders ?? 0],
        ["Model Type", recommendations.model_type ?? ""],
        ["Status", recommendations.status ?? ""],
      ]);

      // Segmentation sheet
      const segRows = Object.entries(segmentation.segments || {}).map(([s, c]) => [s, c]);
      addTableSheet("Segmentation", ["Segment", "Count"], segRows);

      // Seasonal sheet
      addTableSheet("Seasonal Overview", ["Metric", "Value"], [
        ["Has Model", seasonal.has_model ? "Yes" : "No"],
        ["Total Products", seasonal.total_products ?? 0],
        ["Last Trained", seasonal.last_trained_at ? new Date(seasonal.last_trained_at).toLocaleString() : ""],
      ]);

      // Add chart images into a dedicated "Visuals" sheet
      const vs = workbook.addWorksheet("Visuals");
      vs.properties.defaultRowHeight = 20;

      function addImageToSheet(base64DataURI, sheet, tlRow) {
        if (!base64DataURI) return;
        // ExcelJS expects base64 string without data: prefix
        const base64 = base64DataURI.split(",")[1] || base64DataURI;
        try {
          const imageId = workbook.addImage({ base64: base64, extension: "png" });
          // position: columns/rows (tl: top-left, ext: size in px)
          sheet.addImage(imageId, {
            tl: { col: 0, row: tlRow },
            ext: { width: 720, height: 360 },
          });
        } catch (err) {
          // ignore image if ExcelJS fails
          console.warn("Failed to add image to workbook", err);
        }
      }

      // Place images stacked vertically
      let curRow = 0;
      addImageToSheet(imgs[0], vs, curRow); curRow += 20;
      addImageToSheet(imgs[1], vs, curRow); curRow += 20;
      addImageToSheet(imgs[2], vs, curRow); curRow += 20;
      addImageToSheet(imgs[3], vs, curRow); curRow += 20;
      addImageToSheet(imgs[4], vs, curRow); curRow += 20;
      addImageToSheet(imgs[5], vs, curRow); curRow += 20;

      // Write workbook to buffer and download
      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smartretail_reports_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Excel export failed, falling back to HTML export:", err);
      // fallback: use existing HTML export if present
      try {
        if (typeof buildExcelHTML === "function") {
          const htmlContent = buildExcelHTML(data, null);
          const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `admin_reports_${new Date().toISOString().slice(0,10)}.xls`;
          link.click();
          URL.revokeObjectURL(link.href);
        } else {
          alert("Export failed and no fallback available.");
        }
      } catch (fallbackErr) {
        alert("Export failed: " + (err?.message || err));
      }
    }
  }

  // Power BI export UI/JS removed. Use backend URL with `?powerbi=1` to fetch combined dataset.

  // Power BI Report info is displayed in UI section below

  if (loading) {
    return (
      <div className="app-page">
        <AdminSidebar active="admin_reports" />
        <main className="page">
          <div className="reportPanel">Loading reports…</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page">
        <AdminSidebar active="admin_reports" />
        <main className="page">
          <div className="alertBox" style={{ borderLeftColor: "#ef4444", background: "rgba(239,68,68,0.06)" }}>
            {error}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-page">
      <AdminSidebar active="admin_reports" />

      <main className="page">
        <div style={{ marginBottom: "24px" }}>
          <h1 className="pageTitle">Comprehensive Reports</h1>
          <p className="pageSubtitle">Full analytics with visualizations & exports</p>
        </div>

        {/* Advanced Reporting Section with 4-Column Layout */}
        <div className="reportPanel" style={{ background: "rgba(98, 70, 234, 0.06)", borderLeftColor: "var(--accent)", marginBottom: "24px" }}>
          <h3 style={{ marginBottom: "12px", fontSize: "1.1rem", fontWeight: "700", color: "var(--accent)" }}>📊 Advanced Reporting</h3>
          <p style={{ marginBottom: "16px", lineHeight: "1.6", color: "var(--text)" }}>
            Multiple export formats for data sharing, analysis, and integration with external tools.
          </p>

          <p style={{ marginBottom: "16px", fontSize: "0.9rem", fontWeight: "600", color: "var(--text)" }}>
            <strong>Export Options:</strong>
          </p>

          {/* 4-Column Grid */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(4, 1fr)", 
            gap: "16px",
            marginBottom: "16px"
          }}>
            {/* Column 1: Export to Excel */}
            <div className="exportCard">
              <div className="exportCard-content">
                <h4>📊 Export to Excel</h4>
                <p>
                  Downloads an XLSX with data tables and embedded chart images for sharing and archival.
                </p>
              </div>
              <button className="exportBtn" onClick={exportToExcel} style={{ width: "100%" }}>
                Export to Excel
              </button>
            </div>

            {/* Column 2: Power BI JSON */}
            <div className="exportCard">
              <div className="exportCard-content">
                <h4>🔁 Power BI JSON</h4>
                <p>
                  Flattened JSON file for Power BI Web connector or Get Data &gt; JSON import.
                </p>
              </div>
              <button className="exportBtn" onClick={downloadPowerBIJSON} title="Download combined JSON suitable for Power BI Web connector" style={{ width: "100%" }}>
                Download JSON
              </button>
            </div>

            {/* Column 3: HTML Report */}
            <div className="exportCard">
              <div className="exportCard-content">
                <h4>🖼️ HTML Report</h4>
                <p>
                  Self-contained HTML with interactive Chart.js visuals — open in any browser.
                </p>
              </div>
              <button className="exportBtn" onClick={downloadHTMLReport} title="Download self-contained HTML report with visuals" style={{ width: "100%" }}>
                Download HTML
              </button>
            </div>

            {/* Column 4: API URL */}
            <div className="exportCard">
              <div className="exportCard-content">
                <h4>🔗 API URL</h4>
                <p>
                  Direct API endpoint for live data integration with external tools.
                </p>
              </div>
              <button 
                className="exportBtn" 
                onClick={() => {
                  const url = `${API_URL}/api/ml/forecasting/overview/?powerbi=1`;
                  navigator.clipboard.writeText(url);
                  alert("API URL copied to clipboard!");
                }} 
                title="Copy API URL to clipboard" 
                style={{ width: "100%" }}
              >
                Copy URL
              </button>
              <div className="exportCard-codeblock">
                <code>
                  {API_URL}/api/ml/forecasting/overview/?powerbi=1
                </code>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
            <small style={{ color: "var(--muted)" }}>All export formats include complete analytics data from all 6 modules: Forecasting, Inventory, Pricing, Recommendations, Segmentation, and Seasonal Trends.</small>
          </div>
        </div>

        {/* Sales Forecasting */}
        <div className="reportPanel">
          <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>📈 Sales Forecasting</h3>
          <div style={{ height: 280 }}>
            <canvas ref={forecastRef} />
          </div>
          <table className="table" style={{ marginTop: "16px" }}>
            <tbody>
              <tr><th>Metric</th><th>Value</th></tr>
              <tr><td>Next Month Forecast</td><td>₹{Number(data?.forecasting?.forecast_next_month || 0).toLocaleString()}</td></tr>
              <tr><td>Confidence Score</td><td>{(data?.forecasting?.confidence_score || 0).toFixed(3)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Inventory */}
        <div className="reportPanel">
          <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>📦 Inventory Optimization</h3>
          <div style={{ height: 240 }}>
            <canvas ref={inventoryRef} />
          </div>
          <table className="table" style={{ marginTop: "16px" }}>
            <tbody>
              <tr><th>Risk Level</th><th>Count</th></tr>
              <tr><td style={{ color: "#ef4444" }}>High Risk</td><td>{data?.inventory?.high_risk || 0}</td></tr>
              <tr><td style={{ color: "#f7c945" }}>Medium Risk</td><td>{data?.inventory?.medium_risk || 0}</td></tr>
              <tr><td style={{ color: "#22c55e" }}>Low Risk</td><td>{data?.inventory?.low_risk || 0}</td></tr>
              <tr><td><strong>Total</strong></td><td><strong>{data?.inventory?.total_products || 0}</strong></td></tr>
            </tbody>
          </table>
        </div>

        {/* Pricing */}
        <div className="reportPanel">
          <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>💰 Dynamic Pricing</h3>
          <div style={{ height: 240 }}>
            <canvas ref={pricingRef} />
          </div>
          <table className="table" style={{ marginTop: "16px" }}>
            <tbody>
              <tr><th>Metric</th><th>Value</th></tr>
              <tr><td>Optimized Prices</td><td>{data?.pricing?.optimized_prices || 0}</td></tr>
              <tr><td>Acceptance Rate</td><td>{(data?.pricing?.acceptance_rate || 0).toFixed(2)}%</td></tr>
              <tr><td>Revenue Gain</td><td>₹{Number(data?.pricing?.revenue_gain || 0).toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Recommendations */}
        <div className="reportPanel">
          <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>🎯 Recommendations</h3>
          <div style={{ height: 240 }}>
            <canvas ref={recoRef} />
          </div>
          <table className="table" style={{ marginTop: "16px" }}>
            <tbody>
              <tr><th>Metric</th><th>Value</th></tr>
              <tr><td>Active Products</td><td>{data?.recommendations?.active_products || 0}</td></tr>
              <tr><td>Total Interactions</td><td>{data?.recommendations?.total_interactions || 0}</td></tr>
              <tr><td>Total Orders</td><td>{data?.recommendations?.total_orders || 0}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Segmentation */}
        <div className="reportPanel">
          <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>👥 Customer Segmentation</h3>
          <div style={{ height: 240 }}>
            <canvas ref={segRef} style={{ width: "100%", height: "100%" }} />
          </div>
          <table className="table" style={{ marginTop: "16px" }}>
            <tbody>
              <tr><th>Segment</th><th>Customer Count</th><th>% of Total</th><th>Strategy</th></tr>
              {Object.entries(data?.segmentation?.segments || {}).map(([seg, count]) => {
                const total = Object.values(data?.segmentation?.segments || {}).reduce((a, b) => a + Number(b || 0), 0);
                const pct = total === 0 ? "0.0" : ((Number(count || 0) / total) * 100).toFixed(1);
                let strategy = "";
                if (seg === "VIP") strategy = "Premium retention & exclusive offers";
                else if (seg === "LOYAL") strategy = "Loyalty rewards & upsell";
                else if (seg === "ACTIVE") strategy = "Engagement campaigns";
                else if (seg === "NEW") strategy = "Onboarding & education";
                else if (seg === "AT_RISK") strategy = "Win-back campaigns";
                else if (seg === "DORMANT") strategy = "Re-engagement offers";
                return (
                  <tr key={seg}>
                    <td><strong>{seg}</strong></td>
                    <td>{count}</td>
                    <td>{pct}%</td>
                    <td>{strategy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Seasonal Trends */}
        <div className="reportPanel">
          <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: "700" }}>📅 Seasonal Trends</h3>
          <div style={{ height: 240 }}>
            <canvas ref={seasonalRef} style={{ width: "100%", height: "100%" }} />
          </div>
          <table className="table" style={{ marginTop: "16px" }}>
            <tbody>
              <tr><th>Metric</th><th>Value</th></tr>
              <tr>
                <td>Model Available</td>
                <td>
                  <span className={data?.seasonal?.has_model ? "status-badge status-low" : "status-badge status-high"}>
                    {data?.seasonal?.has_model ? "✓ Yes" : "✗ No"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Total Products</td>
                <td><strong>{data?.seasonal?.total_products || 0}</strong></td>
              </tr>
              <tr>
                <td>Last Trained</td>
                <td><strong>{data?.seasonal?.last_trained_at ? new Date(data.seasonal.last_trained_at).toLocaleDateString() : "Never"}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
