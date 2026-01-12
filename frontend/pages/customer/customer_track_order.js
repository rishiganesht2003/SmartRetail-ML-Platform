"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductDetailsNavbar from "@/components/navigation/customer/ProductDetailsNavbar";
import { apiFetch } from "@/lib/api";

/* ================= TRACKING FLOW (ORDERED) ================= */
const ORDER_FLOW = [
  "pending",
  "paid",
  "packed",
  "shipped",
  "delivered",
];

const STATUS_LABELS = {
  pending: "Order Placed",
  paid: "Payment Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function TrackOrder() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("order_id");

  const [theme, setTheme] = useState("dark");
  const [order, setOrder] = useState(null);
  const [timeline, setTimeline] = useState([]);

  /* ================= THEME ================= */
  useEffect(() => {
    const t = localStorage.getItem("customerTheme") || "dark";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  /* ================= LOAD ORDER ================= */
  useEffect(() => {
    if (!orderId) return;

    const loadOrder = async () => {
      const { ok, data } = await apiFetch(
        `/api/orders/orders/${orderId}/`
      );

      if (!ok) return;

      setOrder(data);

      const currentStatus = data.status;

      let steps = [];

      /* ---------- NORMAL ORDER FLOW ---------- */
      if (ORDER_FLOW.includes(currentStatus)) {
        const currentIndex =
          ORDER_FLOW.indexOf(currentStatus);

        steps = ORDER_FLOW.slice(0, currentIndex + 1).map(
          (s) => ({
            key: s,
            title: STATUS_LABELS[s],
            time: data.updated_at || data.placed_at,
          })
        );
      }

      /* ---------- CANCELLED ---------- */
      if (currentStatus === "cancelled") {
        steps = [
          {
            key: "pending",
            title: STATUS_LABELS.pending,
            time: data.placed_at,
          },
          {
            key: "cancelled",
            title: STATUS_LABELS.cancelled,
            time: data.updated_at,
          },
        ];
      }

      setTimeline(steps);
    };

    loadOrder();
  }, [orderId]);

  if (!order) {
    return (
      <div className="page">
        Loading tracking details…
      </div>
    );
  }

  /* ================= ESTIMATED DELIVERY ================= */
  const estimatedDelivery = new Date(
    order.placed_at || Date.now()
  );
  estimatedDelivery.setDate(
    estimatedDelivery.getDate() + 5
  );

  return (
    <div className="root">
      <ProductDetailsNavbar
        theme={theme}
        onToggleTheme={() =>
          setTheme((p) =>
            p === "dark" ? "light" : "dark"
          )
        }
      />

      <div className="trackOrderPage">
        <div className="trackContainer">
          {/* Header */}
          <div className="trackHeader">
            <h2>📦 Track Your Order</h2>
            <div className="orderId">Order #{order.order_id}</div>
          </div>

          {/* Order Summary Card */}
          <div className="orderSummaryCard">
            <div className="summaryTitle">Order Summary</div>
            
            <div className="itemsList">
              {order.items?.map((i, idx) => (
                <div key={idx} className="trackItem">
                  <img
                    src={i.image || "/placeholder.png"}
                    alt={i.name}
                    className="trackItemImg"
                  />

                  <div className="trackItemInfo">
                    <div className="itemName">{i.name}</div>
                    <div className="itemDetails">
                      <span>Qty: {i.qty}</span>
                      <span>₹{(Number(i.price) * Number(i.qty)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="estimateBox">
              <span className="estimateLabel">Estimated Delivery:</span>
              <span className="estimateDate">
                {estimatedDelivery.toDateString()}
              </span>
            </div>
          </div>

          {/* Timeline Card */}
          <div className="timelineCard">
            <div className="timelineTitle">Delivery Status</div>

            <div className="timeline">
              {timeline.map((t, i) => (
                <div key={i} className="timelineStep">
                  <div className="stepIndicator">
                    <div className="stepDot" />
                    {i < timeline.length - 1 && <div className="stepLine" />}
                  </div>
                  <div className="stepContent">
                    <div className="stepTitle">{t.title}</div>
                    <div className="stepTime">
                      {new Date(t.time).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="actionBox">
            <button
              className="btn primary"
              onClick={() =>
                router.push(
                  `/customer/customer_invoice?order_id=${order.order_id}`
                )
              }
            >
              📄 View Invoice
            </button>
            <button
              className="btn ghost"
              onClick={() => router.push("/customer/customer_orders")}
            >
              ← Back to Orders
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
