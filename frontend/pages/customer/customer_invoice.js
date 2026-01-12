"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProductDetailsNavbar from "@/components/navigation/customer/ProductDetailsNavbar";
import { apiFetch } from "@/lib/api";

export default function InvoicePage() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get("order_id");

  const [order, setOrder] = useState(null);

  /* ================= LOAD ORDER ================= */
  useEffect(() => {
    if (!orderId) return;

    const loadOrder = async () => {
      const { ok, data } = await apiFetch(
        `/api/orders/orders/${orderId}/`
      );

      if (ok) setOrder(data);
    };

    loadOrder();
  }, [orderId]);

  if (!order) {
    return <div className="page">Loading invoice…</div>;
  }

  /* ================= SAFE DERIVED DATA ================= */
  const items = Array.isArray(order.items) ? order.items : [];

  const subtotal = Number(order.subtotal ?? 0);
  const discount = Number(order.discount ?? 0);
  const shipping = Number(order.shipping ?? 0);

  const taxableAmount = Math.max(subtotal - discount, 0);

  const GST_RATE = 0.18; // 18% GST
  const tax = +(taxableAmount * GST_RATE).toFixed(2);

  const total = +(
    taxableAmount +
    tax +
    shipping
  ).toFixed(2);

  const invoiceDate = new Date(
    order.placed_at || Date.now()
  ).toLocaleDateString("en-IN");

  const address = order.address || {};

  return (
    <div className="root">
      <ProductDetailsNavbar />

      <div className="page invoicePage" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "40px 20px" }}>
        {/* ================= INVOICE CARD ================= */}
        <div className="invoiceCard" id="print-area" style={{ maxWidth: "900px", margin: "0 auto", padding: "40px", background: "white", color: "#000" }}>
          {/* ================= INVOICE HEADER ================= */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "40px", borderBottom: "2px solid #e5e7eb", paddingBottom: "20px" }}>
            <div>
              <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "800", color: "#1f2937" }}>Smart Retail</h1>
              <p style={{ margin: "4px 0", color: "#6b7280", fontSize: "14px" }}>#12, MG Road, Bengaluru – 560076</p>
              <p style={{ margin: "4px 0", color: "#6b7280", fontSize: "14px" }}>GSTIN: 29ABCDE1234F2Z5</p>
              <p style={{ margin: "4px 0", color: "#6b7280", fontSize: "14px" }}>support@smartretail.in</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>Invoice # {order.order_id}</div>
              <div style={{ fontSize: "14px", color: "#6b7280" }}>Date: {invoiceDate}</div>
            </div>
          </div>

          {/* ================= BILL TO & ORDER DETAILS ================= */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "30px", marginBottom: "40px" }}>
            <div>
              <div style={{ fontSize: "12px", textTransform: "uppercase", color: "#6b7280", fontWeight: "600", marginBottom: "8px" }}>Bill To</div>
              <div style={{ fontSize: "14px", color: "#1f2937", lineHeight: "1.6" }}>
                <div style={{ fontWeight: "600" }}>{address.name || "N/A"}</div>
                <div>{address.address_line || "N/A"}</div>
                <div>{address.city || "N/A"} – {address.pincode || "N/A"}</div>
                <div>📞 {address.phone || "N/A"}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", textTransform: "uppercase", color: "#6b7280", fontWeight: "600", marginBottom: "8px" }}>Order Information</div>
              <div style={{ fontSize: "14px", color: "#1f2937", lineHeight: "1.8" }}>
                <div><span style={{ fontWeight: "600" }}>Order ID:</span> {order.order_id}</div>
                <div><span style={{ fontWeight: "600" }}>Status:</span> {order.status}</div>
                <div><span style={{ fontWeight: "600" }}>Date:</span> {invoiceDate}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", textTransform: "uppercase", color: "#6b7280", fontWeight: "600", marginBottom: "8px" }}>Payment Details</div>
              <div style={{ fontSize: "14px", color: "#1f2937", lineHeight: "1.8" }}>
                <div><span style={{ fontWeight: "600" }}>Method:</span> {order.payment_method || "N/A"}</div>
                <div><span style={{ fontWeight: "600" }}>Items:</span> {items.length}</div>
              </div>
            </div>
          </div>

          {/* ================= ITEMS TABLE ================= */}
          <div style={{ marginBottom: "40px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 0", textAlign: "left", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", color: "#6b7280" }}>Item</th>
                  <th style={{ padding: "12px 0", textAlign: "center", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", color: "#6b7280" }}>Qty</th>
                  <th style={{ padding: "12px 0", textAlign: "right", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", color: "#6b7280" }}>Unit Price</th>
                  <th style={{ padding: "12px 0", textAlign: "right", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", color: "#6b7280" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ padding: "12px 0", textAlign: "center", color: "#6b7280" }}>No items found</td>
                  </tr>
                )}
                {items.map((i, idx) => {
                  const lineTotal = Number(i.price) * Number(i.qty);
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px 0", color: "#1f2937" }}>{i.name}</td>
                      <td style={{ padding: "12px 0", textAlign: "center", color: "#1f2937" }}>{i.qty}</td>
                      <td style={{ padding: "12px 0", textAlign: "right", color: "#1f2937" }}>₹{Number(i.price).toFixed(2)}</td>
                      <td style={{ padding: "12px 0", textAlign: "right", color: "#1f2937", fontWeight: "600" }}>₹{lineTotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ================= TOTALS (RIGHT-ALIGNED) ================= */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "40px" }}>
            <div style={{ width: "280px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6", color: "#6b7280" }}>
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6", color: "#22c55e" }}>
                  <span>Discount</span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6", color: "#6b7280" }}>
                <span>GST (18%)</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
              {shipping > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "2px solid #e5e7eb", color: "#6b7280" }}>
                  <span>Shipping</span>
                  <span>₹{shipping.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", fontSize: "18px", fontWeight: "800", color: "#1f2937" }}>
                <span>Total</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* ================= FOOTER ================= */}
          <div style={{ textAlign: "center", paddingTop: "20px", borderTop: "1px solid #e5e7eb", fontSize: "12px", color: "#6b7280" }}>
            <p style={{ margin: "0" }}>Thank you for your business! 🎉</p>
          </div>
        </div>

        {/* ================= ACTION BUTTONS ================= */}
        <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "28px" }}>
          <button
            className="btn primary"
            onClick={() => window.print()}
            style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}
          >
            🖨️ Print / Download
          </button>

          <button
            className="btn secondary"
            onClick={() =>
              router.push(
                "/customer/customer_orders"
              )
            }
            style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}
          >
            ← Back to Orders
          </button>
        </div>
      </div>
    </div>
  );
}
