"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CustomerNavbar from "@/components/navigation/customer/CustomerNavbar";
import { apiFetch } from "@/lib/api";

export default function CustomerOrderDetailsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const orderId = search.get("order_id");

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ======================
     AUTH
  ====================== */
  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) {
      router.replace("/");
      return;
    }
  }, [router]);

  /* ======================
     LOAD ORDER
  ====================== */
  useEffect(() => {
    if (!orderId) return;

    const loadOrder = async () => {
      setLoading(true);

      const { ok, data } = await apiFetch(
        `/api/orders/orders/${orderId}/`
      );

      if (ok) {
        setOrder(data);
      } else {
        setOrder(null);
      }

      setLoading(false);
    };

    loadOrder();
  }, [orderId]);

  /* ======================
     STATES
  ====================== */
  if (loading) {
    return <div className="page">Loading order details…</div>;
  }

  if (!order) {
    return (
      <div className="page">
        <p>Order not found.</p>
        <button
          className="btn"
          onClick={() =>
            router.push("/customer/customer_orders")
          }
        >
          Back to Orders
        </button>
      </div>
    );
  }

  /* ======================
     SAFE VALUES
  ====================== */
  const subtotal = Number(order.subtotal ?? 0);
  const discount = Number(order.discount ?? 0);
  const total = Number(order.total ?? 0);

  const address = order.address || null;
  const items = Array.isArray(order.items)
    ? order.items
    : [];

  return (
    <div className="root">
      <CustomerNavbar active="orders" />

      <div className="page">
        <h2 className="pageTitle">📄 Order Details</h2>

        {/* ================= ITEMS ================= */}
        <div className="section" style={{ display: "block" }}>
          <div className="sectionTitle">Items</div>

          {items.length === 0 && (
            <div className="muted">No items found</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px", width: "100%", boxSizing: "border-box" }}>
            {items.map((item, idx) => {
              const price = Number(item.price ?? 0);
              const qty = Number(item.qty ?? 1);

              return (
                <div key={idx} className="itemCard" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "16px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", textAlign: "center" }}>
                  <img
                    src={item.image || "/placeholder.png"}
                    className="itemImg"
                    alt={item.name}
                    style={{ width: "140px", height: "140px", objectFit: "cover", borderRadius: "6px" }}
                  />

                  <div className="itemInfo" style={{ width: "100%" }}>
                    <div className="itemName" style={{ fontSize: "15px", fontWeight: "600", marginBottom: "6px" }}>
                      {item.name}
                    </div>
                    <div className="itemQty" style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px" }}>
                      Qty: {qty}
                    </div>
                  </div>

                  <div className="itemPrice" style={{ fontSize: "16px", fontWeight: "700", color: "var(--accent)" }}>
                    ₹{(price * qty).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= AMOUNT SUMMARY (ONE ROW) ================= */}
        <div className="section">
          <div className="sectionTitle">Order #{order.order_id}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
            <div className="card" style={{ padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: "600", marginBottom: "8px" }}>Subtotal</div>
              <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--text)" }}>₹{subtotal.toFixed(2)}</div>
            </div>
            <div className="card" style={{ padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: "600", marginBottom: "8px" }}>Discount</div>
              <div style={{ fontSize: "18px", fontWeight: "700", color: "#22c55e" }}>-₹{discount.toFixed(2)}</div>
            </div>
            <div className="card" style={{ padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: "600", marginBottom: "8px" }}>Total Amount</div>
              <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent)" }}>₹{total.toFixed(2)}</div>
            </div>
            <div className="card" style={{ padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: "600", marginBottom: "8px" }}>Status</div>
              <span className={`badge`} style={{ background: order.status === "delivered" ? "#22c55e" : order.status === "pending" ? "#f7c945" : "#6b7280", color: "white", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "600" }}>
                {order.status || "Processing"}
              </span>
            </div>
          </div>
        </div>

        {/* ================= DELIVERY ADDRESS ================= */}
        <div className="section">
          <div className="sectionTitle">
            Delivery Address
          </div>

          {address ? (
            <div className="addressCard">
              <div className="addressName">
                {address.name}
              </div>

              <div className="addressText">
                {address.address_line}
              </div>

              <div className="addressText">
                {address.city} – {address.pincode}
              </div>

              <div className="addressPhone">
                📞 {address.phone}
              </div>
            </div>
          ) : (
            <div className="muted">
              Address not available
            </div>
          )}
        </div>

        {/* ================= PAYMENT ================= */}
        <div className="section">
          <div className="sectionTitle">Payment Method</div>
          <p>{order.payment_method || "—"}</p>
        </div>

        <button
          className="btnOutline"
          onClick={() =>
            router.push(
              `/customer/customer_track_order?order_id=${orderId}`
            )
          }
        >
          Track Shipment →
        </button>
      </div>
    </div>
  );
}
