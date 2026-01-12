"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerNavbar from "@/components/navigation/customer/CustomerNavbar";
import { apiFetch } from "@/lib/api";

/* ======================
   Helpers
====================== */
function formatINR(value) {
  return (
    "₹" +
    Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatStatus(status) {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ======================
     AUTH + LOAD ORDERS
  ====================== */
  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) {
      router.push("/");
      return;
    }

    async function loadOrders() {
      setLoading(true);

      const res = await apiFetch("/api/orders/orders/");
      if (!res.ok) {
        setOrders([]);
        setLoading(false);
        return;
      }

      setOrders(res.data || []);
      setLoading(false);
    }

    loadOrders();
  }, [router]);

  /* ======================
     RENDER
  ====================== */
  return (
    <div className="root">
      <CustomerNavbar active="orders" />

      <div className="page">
        <h2 className="title">📦 My Orders</h2>

        {loading ? (
          <div className="muted">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="empty">
            You haven’t placed any orders yet.
          </div>
        ) : (
          <div className="ordersGrid">
            {orders.map((o) => (
              <div key={o.order_id} className="orderCard">
                <div className="orderId">
                  Order ID: #{o.order_id}
                </div>

                <div className="orderLine">
                  Date:{" "}
                  {o.placed_at
                    ? new Date(o.placed_at).toLocaleDateString()
                    : "—"}
                </div>

                <div className="orderLine">
                  Total: {formatINR(o.total)}
                </div>

                <span className={`status ${o.status || ""}`}>
                  {formatStatus(o.status)}
                </span>

                <button
                  className="btn"
                  onClick={() =>
                    router.push(
                      `/customer/customer_order_details?order_id=${o.order_id}`
                    )
                  }
                >
                  View Details →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
