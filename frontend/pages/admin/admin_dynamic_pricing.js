"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch } from "@/lib/api";

export default function AdminDynamicPricing() {
  const router = useRouter();
  const appliedOnce = useRef(false);

  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =========================
     LOAD DATA
  ========================= */
  const loadPricing = async (apply = false) => {
    if (!localStorage.getItem("access")) {
      router.replace("/login/admin_login");
      return;
    }

    setLoading(true);
    setError("");

    const oRes = await apiFetch("/api/catalog/pricing/overview/");
    if (!oRes.ok) {
      setError("Failed to load pricing overview");
      setLoading(false);
      return;
    }

    const pRes = await apiFetch("/api/catalog/pricing/products/");
    if (!pRes.ok) {
      setError("Failed to load pricing products");
      setLoading(false);
      return;
    }

    setOverview(oRes.data || {});
    setProducts(pRes.data || []);


    /* 🔥 DEMO FIX: AUTO APPLY PRICING ONCE */
    if (!appliedOnce.current && apply && pRes.data?.length) {
      appliedOnce.current = true;

      try {
        const applyRes = await apiFetch("/api/catalog/pricing/apply/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products: pRes.data }),
        });
        console.debug("auto apply response:", applyRes);
        if (!applyRes.ok) {
          console.warn("Auto-apply failed:", applyRes);
        }
      } catch (err) {
        console.error("Auto-apply error:", err);
      }

      // Re-fetch to show updated prices
      const refreshed = await apiFetch(
        "/api/catalog/pricing/products/"
      );
      if (refreshed.ok) {
        setProducts(refreshed.data || []);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadPricing(true);
  }, []);

  /* =========================
     DERIVED AI INSIGHTS
  ========================= */
  const insights = [];
  if (overview) {
    if (overview.optimized_prices > 0) {
      insights.push(
        `✅ ${overview.optimized_prices} products optimized using AI`
      );
    }
    if (overview.acceptance_rate > 90) {
      insights.push(
        `🔥 Strong pricing acceptance rate (${overview.acceptance_rate}%)`
      );
    }
  }

  // Compute affected product count from products array (use existing data only).
  const affectedCount = products
    ? products.reduce((acc, p) => {
        // treat a product as affected if change != 0 or new_price differs from old_price
        const changeVal = Number(p.change || 0);
        const oldP = Number(p.old_price || 0);
        const newP = Number(p.new_price || 0);
        if (Math.abs(changeVal) > 0.0001 || Math.abs(newP - oldP) > 0.0001) return acc + 1;
        return acc;
      }, 0)
    : 0;

  /* =========================
     UI
  ========================= */
  return (
    <div className="app-page">
      <AdminSidebar active="admin_dynamic_pricing" />

      <main className="main">
        <h1 className="pageTitle">Dynamic Pricing</h1>
        <p className="pageSubtitle">
          AI-powered price optimization based on real demand signals
        </p>

        {loading ? (
          <div>Loading pricing data...</div>
        ) : error ? (
          <div className="errorText">{error}</div>
        ) : (
          <>
            {/* KPI SUMMARY + ACTION */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "18px", marginBottom: "28px" }}>
              <div className="card cardPurple">
                <div className="labelPill">Optimized Products</div>
                <div className="value">
                  {affectedCount || overview.optimized_prices}
                </div>
              </div>

              <div className="card cardBlue">
                <div className="labelPill">Acceptance Rate</div>
                <div className="value">
                  {overview.acceptance_rate}%
                </div>
              </div>

              <button
                className="btn primary"
                onClick={async () => {
                  try {
                    const res = await apiFetch("/api/catalog/pricing/apply/", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ products }),
                    });
                    console.debug("manual apply response:", res);
                    if (!res.ok) {
                      alert("Failed to apply pricing — see console for details.");
                    } else {
                      // reload after successful apply
                      await loadPricing(false);
                    }
                  } catch (err) {
                    console.error("Apply error:", err);
                    alert("Apply failed — check console.");
                  }
                }}
                style={{ padding: "0 16px" }}
              >
                Apply Dynamic Pricing
              </button>
            </div>

            {/* PRICING TABLE */}
            <div className="card" style={{ marginTop: 24 }}>
              <h3 className="cardTitle">Price Adjustments</h3>

              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Old Price</th>
                    <th>New Price</th>
                    <th>Change</th>
                    <th>AI Reason</th>
                  </tr>
                </thead>

                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan="6">No pricing data available</td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const changeNum = Number(p.change || 0);
                      const changeText = `${changeNum > 0 ? "+" : ""}${changeNum.toFixed(4)}%`;

                      return (
                        <tr key={p.id}>
                          <td className="productCell">
                            {p.image && (
                              <img
                                src={p.image}
                                alt={p.name}
                                style={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: 8,
                                  objectFit: "cover",
                                }}
                              />
                            )}
                            <div className="prodName">{p.name}</div>
                          </td>
                          <td>{p.category}</td>
                          <td>₹{p.old_price}</td>
                          <td>
                            <b>₹{p.new_price}</b>
                          </td>
                          <td
                            style={{
                              color: changeNum >= 0 ? "#22c55e" : "#ef4444",
                              fontWeight: 600,
                            }}
                          >
                            {changeText}
                          </td>
                          <td>{p.ai_reason}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* AI INSIGHTS */}
            <div className="card" style={{ marginTop: 24 }}>
              <h3 className="cardTitle">
                Pricing Insights & Recommendations
              </h3>

              {insights.length > 0 ? (
                insights.map((i, idx) => (
                  <p key={idx}>{i}</p>
                ))
              ) : (
                <p>No insights available</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
