"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Chart from "chart.js/auto";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch } from "@/lib/api";

export default function AdminInventoryOptimization() {
  const router = useRouter();

  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const riskChartRef = useRef(null);
  const daysChartRef = useRef(null);
  const riskChart = useRef(null);
  const daysChart = useRef(null);

  /* =========================
     LOAD INVENTORY DATA
  ========================= */
  const loadInventory = async () => {
    if (!localStorage.getItem("access")) {
      router.replace("/login/admin_login");
      return;
    }

    setLoading(true);
    setError("");

    const oRes = await apiFetch("/api/ml/inventory/overview/");
    if (!oRes.ok) {
      setError("Failed to load inventory overview");
      setLoading(false);
      return;
    }

    const pRes = await apiFetch("/api/ml/inventory/products/");
    if (!pRes.ok) {
      setError("Failed to load inventory products");
      setLoading(false);
      return;
    }

    setOverview(oRes.data);
    setProducts(pRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadInventory();
  }, []);

  /* =========================
     RISK DISTRIBUTION CHART
  ========================= */
  useEffect(() => {
    if (!overview || !riskChartRef.current) return;

    riskChart.current?.destroy();

    riskChart.current = new Chart(
      riskChartRef.current.getContext("2d"),
      {
        type: "doughnut",
        data: {
          labels: ["Low Risk", "Medium Risk", "High Risk"],
          datasets: [
            {
              data: [
                overview.low_risk,
                overview.medium_risk,
                overview.high_risk,
              ],
            },
          ],
        },
      }
    );

    return () => riskChart.current?.destroy();
  }, [overview]);

  /* =========================
     DAYS LEFT CHART
  ========================= */
  useEffect(() => {
    if (!products.length || !daysChartRef.current) return;

    daysChart.current?.destroy();

    daysChart.current = new Chart(
      daysChartRef.current.getContext("2d"),
      {
        type: "bar",
        data: {
          labels: products.map((p) => p.name),
          datasets: [
            {
              label: "Days Left",
              data: products.map((p) =>
                p.days_left !== null ? p.days_left : 0
              ),
            },
          ],
        },
      }
    );

    return () => daysChart.current?.destroy();
  }, [products]);

  /* =========================
     HELPERS
  ========================= */
  const statusClass = (risk) => {
    if (risk === "HIGH") return "status-badge status-inactive";
    if (risk === "MEDIUM") return "status-badge status-warning";
    return "status-badge status-active";
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="app-page">
      <AdminSidebar active="admin_inventory_optimization" />

      <main className="main">
        <h1 className="pageTitle">Inventory Optimization</h1>
        <p className="pageSubtitle">
          AI-powered inventory health & restocking insights
        </p>

        {loading ? (
          <div>Loading inventory data...</div>
        ) : error ? (
          <div className="errorText">{error}</div>
        ) : (
          <>
            {/* SUMMARY */}
            <div className="summaryGrid cols3">
              <div className="card cardPurple">
                <div className="labelPill">Low Risk</div>
                <div className="value">{overview.low_risk}</div>
              </div>

              <div className="card cardBlue">
                <div className="labelPill">Medium Risk</div>
                <div className="value">{overview.medium_risk}</div>
              </div>

              <div className="card cardGreen">
                <div className="labelPill">High Risk</div>
                <div className="value">{overview.high_risk}</div>
              </div>
            </div>

            {/* CHARTS */}
            <div className="chartsGrid" style={{ marginTop: 24 }}>
              <div className="card">
                <h3 className="cardTitle">Inventory Risk Distribution</h3>
                <canvas ref={riskChartRef} />
              </div>

              <div className="card">
                <h3 className="cardTitle">Estimated Days Left</h3>
                <canvas ref={daysChartRef} />
              </div>
            </div>

            {/* INVENTORY TABLE */}
            <div className="card" style={{ marginTop: 24 }}>
              <h3 className="cardTitle">Inventory Status</h3>

              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Days Left</th>
                    <th>Recommended Restock</th>
                  </tr>
                </thead>

                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan="6">No products available</td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.id}>
                        <td className="flex">
                          {p.image && (
                            <img
                              src={p.image}
                              alt={p.name}
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 8,
                                objectFit: "cover",
                                marginRight: 8,
                              }}
                            />
                          )}
                          {p.name}
                        </td>

                        <td>{p.category}</td>
                        <td>{p.stock}</td>

                        <td>
                          <span className={statusClass(p.risk)}>
                            {p.risk}
                          </span>
                        </td>

                        <td>
                          {p.days_left !== null
                            ? `${p.days_left} days`
                            : "N/A"}
                        </td>

                        <td>{p.reorder_qty}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* AI INSIGHTS */}
            <div className="card" style={{ marginTop: 24 }}>
              <h3 className="cardTitle">AI Insights</h3>

              {overview.insights.length > 0 ? (
                overview.insights.map((i, idx) => (
                  <p key={idx}>{i}</p>
                ))
              ) : (
                <p>No current insights</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
