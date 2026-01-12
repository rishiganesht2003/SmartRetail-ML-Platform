"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerNavbar from "@/components/navigation/customer/CustomerNavbar";

export default function CustomerOrderSuccessPage() {
  const router = useRouter();

  const [theme, setTheme] = useState("dark");
  const [order, setOrder] = useState(null);

  /* ======================
     THEME INIT
  ====================== */
  useEffect(() => {
    const saved =
      localStorage.getItem("customerTheme") || "dark";

    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("customerTheme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  /* ======================
     LOAD LAST ORDER (SAFE)
  ====================== */
  useEffect(() => {
    const raw = localStorage.getItem("lastOrder");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      setOrder(parsed);
    } catch (err) {
      console.error("Invalid lastOrder", err);
      setOrder(null);
    }
  }, []);

  /* ======================
     SAFE FALLBACK
  ====================== */
  const orderId = order?.order_id || "—";
  const status = order?.status || "Processing";
  const totalPaid = Number(
    order?.total || order?.total_amount || 0
  ).toFixed(2);

  return (
    <div className="root">
      <CustomerNavbar />

      <div className="page">
        <div className="successBox">
          <div className="tickAnim">✅</div>

          <h2 className="title">
            Order Placed Successfully!
          </h2>

          <p className="msg">
            Thank you for shopping with Smart Retail.
          </p>

          {order && (
            <div className="orderSummary">
              <div className="orderRow">
                <span>Order ID</span>
                <strong>{orderId}</strong>
              </div>

              <div className="orderRow">
                <span>Status</span>
                <strong>{status}</strong>
              </div>

              <div className="orderRow total">
                <span>Total Paid</span>
                <strong>₹{totalPaid}</strong>
              </div>
            </div>
          )}

          {!order && (
            <div className="warningText">
              Order details not found. You can view your
              order from the Orders page.
            </div>
          )}

          <div className="actions">
            <button
              className="btn"
              onClick={() =>
                router.push("/customer/customer_products")
              }
            >
              Continue Shopping →
            </button>

            <button
              className="btn btnSecondary"
              onClick={() =>
                router.push("/customer/customer_orders")
              }
            >
              View Orders
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
