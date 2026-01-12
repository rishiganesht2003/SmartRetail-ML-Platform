"use client";

import { useEffect, useState, useRef } from "react";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch } from "@/lib/api";

export default function AdminRecommendationsPage() {
  const [data, setData] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const demandCanvas = useRef(null);
  let chartRef = useRef(null);

  // Set root theme on mount
  useEffect(() => {
    try {
      const theme = localStorage.getItem("adminTheme") || localStorage.getItem("theme") || "dark";
      document.documentElement.setAttribute("data-theme", theme);
    } catch (e) {
      /* silent */
    }
  }, []);

  // Fetch recommendations data
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      window.location.href = "/login/admin_login";
      return;
    }

    async function loadRecommendations() {
      setLoading(true);
      setError("");

      try {
        // Fetch overview (summary stats)
        const overviewRes = await apiFetch("/api/ml/recommendation/overview/");
        
        // Fetch product list
        const productsRes = await apiFetch("/api/ml/recommendation/products/");

        if (overviewRes.ok) {
          setData(overviewRes.data || {});
        } else {
          setError("Failed to load overview");
        }

        if (productsRes.ok) {
          setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
        } else {
          console.warn("Failed to load products list");
        }

        if (!overviewRes.ok && !productsRes.ok) {
          setError("Failed to load recommendations");
        }
      } catch (err) {
        setError("Error loading recommendations: " + err.message);
      } finally {
        setLoading(false);
      }
    }

    loadRecommendations();
  }, []);

  const handleRetrain = async () => {
    if (!confirm("Retrain recommendation engine?")) return;

    const res = await apiFetch("/api/ml/recommendation/retrain/", { method: "POST" });
    if (res.ok) {
      alert("Recommendation engine retraining started");
      // Reload data
      window.location.reload();
    } else {
      alert("Retrain failed");
    }
  };

  useEffect(() => {
    if (!loading && products.length) {
      (async () => {
        if (typeof window === "undefined") return;
        if (!window.Chart) {
          await new Promise((res) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
            s.onload = res;
            document.head.appendChild(s);
          });
        }
        try { chartRef.current?.destroy?.(); } catch {}
        const labels = products.map(p => p.name);
        const vals = products.map(p => p.demand_score || 0);
        const ctx = demandCanvas.current?.getContext("2d");
        if (ctx) {
          chartRef.current = new Chart(ctx, {
            type: "bar",
            data: { labels, datasets: [{ label: "Demand Score", data: vals, backgroundColor: vals.map(v => v>=75? "#22c55e": v>=40? "#f7c945": "#ef4444") }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
          });
        }
      })();
    }
    return () => { try { chartRef.current?.destroy?.(); } catch {} };
  }, [loading, products]);

  if (loading) {
    return (
      <div className="app-page">
        <AdminSidebar active="admin_recommendation_engine" />
        <main className="page">
          <div className="reportPanel">Loading recommendations…</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page">
        <AdminSidebar active="admin_recommendation_engine" />
        <main className="page">
          <div className="alertBox" style={{ borderLeftColor: "#ef4444", background: "rgba(239,68,68,0.1)" }}>
            {error}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-page">
      <AdminSidebar active="admin_recommendation_engine" />

      <main className="page">
        <h1 className="pageTitle">Recommendation Engine</h1>
        <div className="reportPanel">
          <h3>Demand Distribution</h3>
          <div style={{ height: 240 }}>
            <canvas ref={demandCanvas} />
          </div>
        </div>

        <div className="reportPanel">
          <h3>Recommended Products</h3>
          <div className="tableWrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Demand Score</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      {product.image && <img src={product.image} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />}
                      <div>{product.name}</div>
                    </td>
                    <td>{product.category}</td>
                    <td>₹{product.price?.toFixed(2) || "—"}</td>
                    <td>
                      <div className="status-badge" style={{ background: product.demand_score >= 75 ? "rgba(34,197,94,0.16)" : product.demand_score >= 40 ? "rgba(247,201,69,0.16)" : "rgba(239,68,68,0.16)", color: product.demand_score >= 75 ? "#22c55e" : product.demand_score >= 40 ? "#f7c945" : "#ef4444" }}>
                        {product.demand_score}%
                      </div>
                    </td>
                    <td>{product.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ML Notes */}
        <div className="reportPanel">
          <h3 style={{ marginBottom: "14px", fontSize: "1.2rem", fontWeight: "700" }}>
            ℹ️ ML Notes
          </h3>
          <p style={{ color: "var(--muted)", lineHeight: "1.6" }}>
            Recommendation engine uses co-purchase frequency and customer segmentation to suggest products.
            <br />
            Automation Center controls retraining & inference cycles.
            <br />
            Cached recommendations are served when automation is OFF.
          </p>
        </div>
      </main>
    </div>
  );
}
