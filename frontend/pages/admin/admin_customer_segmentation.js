"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Chart from "chart.js/auto";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch } from "@/lib/api";

const SEGMENT_COLORS = {
  VIP: "#FFD700",
  LOYAL: "#4CAF50",
  ACTIVE: "#2196F3",
  NEW: "#FF9800",
  AT_RISK: "#F44336",
  DORMANT: "#9E9E9E",
};

export default function AdminCustomerSegmentationPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [recomputingSegments, setRecomputingSegments] = useState(false);

  const segmentChartRef = useRef(null);
  const spendChartRef = useRef(null);
  const segmentChart = useRef(null);
  const spendChart = useRef(null);

  /* =========================
     LOAD DATA
  ========================= */
  const loadSegmentation = async () => {
    if (!localStorage.getItem("access")) {
      router.replace("/login/admin_login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Fetch overview
      const overRes = await apiFetch("/api/ml/segmentation/overview/");
      if (overRes.ok) {
        setSummary(overRes.data);
      }

      // Fetch customer details
      const cRes = await apiFetch("/api/ml/segmentation/customers/");
      if (cRes.ok && Array.isArray(cRes.data)) {
        setCustomers(cRes.data);
      }

      /* ---------- BUILD CLUSTERS ---------- */
      const clusterMap = {};

      cRes.data.forEach((c) => {
        const key = c.segment || "UNKNOWN";
        if (!clusterMap[key]) {
          clusterMap[key] = {
            name: key,
            count: 0,
            total_spend: 0,
          };
        }
        clusterMap[key].count += 1;
        clusterMap[key].total_spend += c.total_spent || 0;
      });

      const totalCustomers = cRes.data.length || 1;

      const computedClusters = Object.values(clusterMap).map((c) => ({
        name: c.name,
        count: c.count,
        avg_spend: Math.round(c.total_spend / c.count),
        share: Math.round((c.count / totalCustomers) * 100),
      }));

      setClusters(computedClusters);
    } catch (err) {
      console.error(err);
      setError("Could not load customer segmentation data.");
    }

    setLoading(false);
  };

  useEffect(() => {
    loadSegmentation();
  }, []);

  /* =========================
     SEGMENT DISTRIBUTION CHART
  ========================= */
  useEffect(() => {
    if (!clusters.length || !segmentChartRef.current) return;

    segmentChart.current?.destroy();

    segmentChart.current = new Chart(
      segmentChartRef.current.getContext("2d"),
      {
        type: "doughnut",
        data: {
          labels: clusters.map((c) => c.name),
          datasets: [
            {
              data: clusters.map((c) => c.count),
            },
          ],
        },
      }
    );

    return () => segmentChart.current?.destroy();
  }, [clusters]);

  /* =========================
     AVG SPEND CHART
  ========================= */
  useEffect(() => {
    if (!clusters.length || !spendChartRef.current) return;

    spendChart.current?.destroy();

    spendChart.current = new Chart(
      spendChartRef.current.getContext("2d"),
      {
        type: "bar",
        data: {
          labels: clusters.map((c) => c.name),
          datasets: [
            {
              label: "Avg Spend (₹)",
              data: clusters.map((c) => c.avg_spend),
            },
          ],
        },
      }
    );

    return () => spendChart.current?.destroy();
  }, [clusters]);

  const handleRecomputeSegments = async () => {
    setRecomputingSegments(true);
    try {
      const res = await apiFetch("/api/ml/segmentation/recompute_all/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        alert(`✅ Segmentation recomputed for ${res.data.updated} customers`);
        loadSegmentation();
      } else {
        alert("❌ Error recomputing segmentation");
      }
    } catch (e) {
      console.error("Error:", e);
      alert("❌ Error recomputing segmentation");
    } finally {
      setRecomputingSegments(false);
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="app-page">
      <AdminSidebar active="admin_customer_segmentation" />

      <main className="main">
        <h1 className="pageTitle">Customer Segmentation</h1>
        <p className="pageSubtitle">
          ML-powered customer behavior grouping
        </p>

        {loading ? (
          <div>Loading segmentation...</div>
        ) : error ? (
          <div className="errorText">{error}</div>
        ) : (
          <>
            {/* SUMMARY + REFRESH BUTTON */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "18px", marginTop: 20 }}>
              <div className="card cardPurple">
                <div className="labelPill">Total Customers</div>
                <div className="value">
                  {summary.total_customers}
                </div>
              </div>

              <div className="card cardGreen">
                <div className="labelPill">VIP</div>
                <div className="value">
                  {summary.segments?.VIP || 0}
                </div>
              </div>

              <div className="card cardBlue">
                <div className="labelPill">At Risk</div>
                <div className="value">
                  {summary.segments?.AT_RISK || 0}
                </div>
              </div>

              <button className="btn ghost" onClick={loadSegmentation} style={{ padding: "22px 16px", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                Refresh
              </button>
            </div>

            {/* CHARTS (side-by-side, reduced height) */}
            <div className="chartsGrid" style={{ marginTop: 32, gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div className="card">
                <h3 className="cardTitle">Customer Distribution</h3>
                <canvas ref={segmentChartRef} className="chartCanvas" style={{ width: "100%", height: 220 }} />
              </div>

              <div className="card">
                <h3 className="cardTitle">Avg Spend by Segment</h3>
                <canvas ref={spendChartRef} className="chartCanvas" style={{ width: "100%", height: 220 }} />
              </div>
            </div>

            {/* THREE-COLUMN LAYOUT: OVERVIEW, CLUSTERS, SAMPLE CUSTOMERS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "18px", marginTop: "32px" }}>
              
              {/* COLUMN 1: OVERVIEW CARD */}
              <div className="card overviewCard">
                <div style={{ marginBottom: "16px" }}>
                  <h2 style={{ marginBottom: "4px", fontSize: "1.1rem" }}>Total Customers: {summary.total_customers}</h2>
                  <p className="cardSubtitle">Across {Object.keys(summary.segments || {}).length} segments</p>
                </div>

                <button
                  className="btn primary"
                  onClick={handleRecomputeSegments}
                  disabled={recomputingSegments}
                  aria-disabled={recomputingSegments}
                  style={{ fontSize: "0.75rem", padding: "6px 10px", width: "100%", marginBottom: "16px" }}
                >
                  {recomputingSegments ? "Recomputing..." : "Recompute"}
                </button>

                {/* SEGMENT DISTRIBUTION (tiles use theme-aware classes already) */}
                <div style={{ marginBottom: "16px" }}>
                  <h3 style={{ marginBottom: "10px", fontSize: "0.95rem" }}>Segment Distribution</h3>
                  <div className="segTiles">
                    {Object.entries(summary.segments || {}).map(([seg, count]) => {
                      const segClass = String(seg).toLowerCase().replace(/[^a-z0-9_]/g, "_");
                      return (
                        <div key={seg} className={`seg-tile ${segClass}`}>
                          <div className="seg-count">{count}</div>
                          <div className="seg-label">{seg}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* INSIGHTS — use theme-aware .insightsBox / .insightItem */}
                {summary.insights && summary.insights.length > 0 && (
                  <div>
                    <h3 style={{ marginBottom: "8px", fontSize: "0.95rem" }}>Insights</h3>
                    <div className="insightsBox" style={{ padding: "12px" }}>
                      {summary.insights.map((insight, idx) => (
                        <div key={idx} className="insightItem">{insight}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* COLUMN 2: CLUSTER TABLE */}
              <div className="card">
                <h3 className="cardTitle" style={{ marginBottom: "16px" }}>Customer Clusters</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Cluster</th>
                      <th>Customers</th>
                      <th>Avg Spend (₹)</th>
                      <th>Share (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clusters.map((c) => (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td>{c.count}</td>
                        <td>₹{c.avg_spend}</td>
                        <td>{c.share}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* COLUMN 3: SAMPLE CUSTOMERS */}
              {customers.length > 0 && (
                <div className="card">
                  <h3 className="cardTitle" style={{ marginBottom: "16px" }}>Sample Customers</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {customers.slice(0, 5).map((c, i) => (
                      <div key={i} style={{ paddingBottom: "8px", borderBottom: "1px solid rgba(148, 163, 184, 0.18)" }}>
                        <b style={{ fontSize: "0.9rem" }}>{c.name}</b>
                        <br />
                        <small style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{c.email}</small>
                        <br />
                        <span className="badge" style={{ marginTop: "4px", display: "inline-block", fontSize: "0.75rem" }}>
                          {c.segment}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
