"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch } from "@/lib/api";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [role, setRole] = useState("");
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [modalOrder, setModalOrder] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");

  /* =========================
     LOAD ORDERS
  ========================= */
  async function loadOrders() {
    setLoading(true);
    setError("");

    const prof = await apiFetch("/api/accounts/profile/");
    if (!prof.ok) {
      setError("Authentication failed");
      setLoading(false);
      return;
    }
    setRole(prof.data.role);

    const res = await apiFetch("/api/orders/admin/orders/");
    if (!res.ok) {
      setError("Failed to load orders");
      setLoading(false);
      return;
    }

    setOrders(res.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  /* =========================
     SEARCH AND STATUS FILTER
  ========================= */
  const filteredOrders = useMemo(() => {
    const term = search.toLowerCase().trim();
    let baseOrders;

    if (!term) {
      baseOrders = orders.slice(0, 20); // Default: show only 20 most recent orders
    } else {
      // Search all orders when term is present
      baseOrders = orders.filter(
        (o) =>
          o.order_id.toLowerCase().includes(term) ||
          o.customer.toLowerCase().includes(term) ||
          o.status.toLowerCase().includes(term)
      );
    }

    // Apply status filter if selected
    if (statusFilter) {
      baseOrders = baseOrders.filter((o) => o.status === statusFilter);
    }

    return baseOrders;
  }, [orders, search, statusFilter]);

  /* =========================
     CANCEL ORDER
  ========================= */
  async function cancelOrder(orderId) {
    if (role !== "admin") return;

    if (!confirm("Cancel this order?")) return;

    const res = await apiFetch(
      `/api/orders/admin/orders/${orderId}/`,
      { method: "PATCH", body: { status: "cancelled" } }
    );

    if (!res.ok) {
      alert("Cancel failed");
      return;
    }

    loadOrders();
  }

  function canCancel(status) {
    return !["cancelled", "delivered", "returned"].includes(status);
  }

  /* =========================
     ORDER DETAILS MODAL (moved from standalone admin_order_details)
  ========================= */
  function openOrderModal(orderId) {
    setShowOrderModal(true);
    setModalLoading(true);
    setModalOrder(null);
    setError("");

    loadModalOrder(orderId);
  }

  async function loadModalOrder(orderId) {
    setModalLoading(true);
    setError("");

    const res = await apiFetch(`/api/orders/admin/orders/${orderId}/`);
    if (!res.ok) {
      setError("Failed to load order");
      setModalLoading(false);
      return;
    }

    setModalOrder(res.data);
    setModalLoading(false);
  }

  async function updateStatusForModal(orderId, status) {
    if (!confirm(`Change order status to "${status}"?`)) return;
    setModalLoading(true);
    const res = await apiFetch(`/api/orders/admin/orders/${orderId}/`, {
      method: "PATCH",
      body: { status },
    });

    console.log('updateStatusForModal response:', res);

    if (!res.ok) {
      setError(res.data?.detail || 'Update failed');
      setModalLoading(false);
      return;
    }

    // reload modal order and list
    await loadModalOrder(orderId);
    setModalLoading(false);
    await loadOrders();
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="app-page">
      <AdminSidebar active="admin_orders" />

      <main className="main">
        <h1 className="pageTitle">Orders</h1>
        <p className="pageSubtitle">Order lifecycle overview</p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
          <input
            className="modalInput"
            placeholder="Search by order id, customer, status"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 340 }}
          />

          <select
            className="modalInput"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: 150 }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div>Loading orders…</div>
        ) : error ? (
          <div className="errorText">{error}</div>
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Total (₹)</th>
                  <th>Status</th>
                  <th>Placed</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="center">
                      No orders found
                    </td>
                  </tr>
                )}

                {filteredOrders.map((o) => (
                  <tr key={o.order_id}>
                    <td>{o.order_id}</td>
                    <td>{o.customer}</td>
                    <td>₹{o.total_inr}</td>
                    <td>{o.status}</td>
                    <td>{new Date(o.placed_at).toLocaleString()}</td>
                    <td>
                      <div className="flex gap">
                            <button
                              className="btn ghost"
                              onClick={() => openOrderModal(o.order_id)}
                            >
                              View
                            </button>

                        {role === "admin" && (
                          <button
                            className="btn danger"
                            disabled={!canCancel(o.status)}
                            onClick={() => cancelOrder(o.order_id)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ORDER DETAILS MODAL */}
        {showOrderModal && (
          <div
            className="modalOverlay"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-details-title"
            onKeyDown={(e) => { if (e.key === 'Escape') setShowOrderModal(false); }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowOrderModal(false); }}
          >
            <div className="modalCard">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 id="order-details-title">{modalLoading ? 'Loading…' : (modalOrder?.order_id || 'Order Details')}</h3>
                <button className="btn ghost" onClick={() => setShowOrderModal(false)}>Close</button>
              </div>

              {modalLoading && <div>Loading order…</div>}
              {!modalLoading && modalOrder && (
                <>
                  <div className="card" style={{ marginBottom: 20 }}>
                    <h2>{modalOrder.order_id}</h2>

                    <p>
                      <b>Status:</b>{' '}
                      <span className={`badge ${modalOrder.status}`}>
                        {modalOrder.status.replace('_', ' ')}
                      </span>
                    </p>

                    <p><b>Payment Method:</b> {modalOrder.payment_method}</p>
                    <p><b>Subtotal:</b> ₹{modalOrder.subtotal_inr}</p>
                    <p><b>Discount:</b> ₹{modalOrder.discount_inr}</p>
                    <p><b>Total Amount:</b> ₹{modalOrder.total_inr}</p>
                    <p><b>Placed At:</b> {new Date(modalOrder.placed_at).toLocaleString()}</p>
                    {modalOrder.updated_at && <p><b>Updated At:</b> {new Date(modalOrder.updated_at).toLocaleString()}</p>}

                    <p>
                      <b>Customer:</b>{' '}
                      {modalOrder.customer?.username} ({modalOrder.customer?.email})
                    </p>

                    {role === 'admin' && (
                      <div className="flex gap" style={{ marginTop: 10 }}>
                        {modalOrder.status === 'pending' && (
                          <button className="btn primary" onClick={() => updateStatusForModal(modalOrder.order_id, 'shipped')} disabled={modalLoading}>Mark Shipped</button>
                        )}

                        {modalOrder.status === 'shipped' && (
                          <button className="btn primary" onClick={() => updateStatusForModal(modalOrder.order_id, 'delivered')} disabled={modalLoading}>Mark Delivered</button>
                        )}

                        {!['cancelled', 'delivered'].includes(modalOrder.status) && (
                          <button className="btn danger" onClick={() => updateStatusForModal(modalOrder.order_id, 'cancelled')} disabled={modalLoading}>Cancel Order</button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="card" style={{ marginBottom: 20 }}>
                    <h3 className="cardTitle">Shipping Address</h3>
                    {modalOrder.address ? (
                      <div className="addressCard">
                        <div className="addressName">
                          {modalOrder.address.name}
                        </div>

                        <div className="addressText">
                          {modalOrder.address.address_line}
                        </div>

                        <div className="addressText">
                          {modalOrder.address.city} – {modalOrder.address.pincode}
                        </div>

                        <div className="addressPhone">
                          📞 {modalOrder.address.phone}
                        </div>
                      </div>
                    ) : (
                      <div className="muted">Address not available</div>
                    )}
                  </div>

                  <div className="card">
                    <h3 className="cardTitle">Order Items</h3>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>Unit Price (₹)</th>
                          <th>Line Total (₹)</th>
                          <th>Item Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalOrder.items.map((i) => (
                          <tr key={i.id}>
                            <td>{i.product}</td>
                            <td>{i.quantity}</td>
                            <td>₹{i.price_inr}</td>
                            <td>₹{i.line_total}</td>
                            <td>{i.item_status.replace('_', ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
