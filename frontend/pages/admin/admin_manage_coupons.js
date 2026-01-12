"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch } from "@/lib/api";

export default function AdminManageCoupons() {
  const router = useRouter();

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    code: "",
    discount_amount: "",
    discount_percent: "",
    is_active: true,
    allowed_payment_methods: [],
  });

  /* =========================
     AUTH + LOAD
  ========================= */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      router.replace("/login/admin_login");
      return;
    }
    loadCoupons();
  }, []);

  async function loadCoupons() {
    setLoading(true);
    setError("");

    // role check
    const prof = await apiFetch("/api/accounts/profile/");
    if (!prof.ok || prof.data.role !== "admin") {
      router.replace("/login/admin_login");
      return;
    }

    const res = await apiFetch("/api/orders/admin/coupons/");
    if (!res.ok) {
      setError("Failed to load coupons");
      setLoading(false);
      return;
    }

    setCoupons(res.data || []);
    setLoading(false);
  }

  /* =========================
     CREATE COUPON
  ========================= */
  async function createCoupon() {
    if (!form.code.trim() || !form.discount_amount) {
      alert("Coupon code and discount amount are required");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      discount_amount: Number(form.discount_amount || 0),
      discount_percent: Number(form.discount_percent || 0),
    };

    const res = await apiFetch("/api/orders/admin/coupons/", {
      method: "POST",
      body: payload,
    });

    if (!res.ok) {
      setError("Failed to create coupon");
      setSaving(false);
      return;
    }

    setForm({
      code: "",
      discount_amount: "",
      discount_percent: "",
      is_active: true,
      allowed_payment_methods: [],
    });

    setSaving(false);
    loadCoupons();
  }

  /* =========================
     UPDATE COUPON
  ========================= */
  async function toggleCoupon(c) {
    await apiFetch(`/api/orders/admin/coupons/${c.id}/`, {
      method: "PATCH",
      body: { is_active: !c.is_active },
    });
    loadCoupons();
  }

  /* =========================
     DELETE COUPON
  ========================= */
  async function deleteCoupon(id) {
    if (!confirm("Delete this coupon permanently?")) return;

    await apiFetch(`/api/orders/admin/coupons/${id}/`, {
      method: "DELETE",
    });

    loadCoupons();
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="app-page">
      <AdminSidebar active="admin_manage_coupons" />

      <main className="main">
        <h1 className="pageTitle">Manage Coupons</h1>
        <p className="pageSubtitle">
          Create, enable, disable and control discount coupons
        </p>

        {error && <div className="errorText">{error}</div>}

        {/* CREATE */}
        <div className="card">
          <h3 className="cardTitle">Create Coupon</h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '14px',
            marginBottom: '0px',
            alignItems: 'end'
          }}>
            <input
              className="input"
              placeholder="Coupon Code"
              value={form.code}
              onChange={(e) =>
                setForm({
                  ...form,
                  code: e.target.value.toUpperCase(),
                })
              }
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit' }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="number"
                min="1"
                className="input"
                placeholder="Discount Amount (₹)"
                value={form.discount_amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discount_amount: e.target.value,
                  })
                }
                style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit', minWidth: 120 }}
              />

              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="input"
                placeholder="Discount %"
                value={form.discount_percent || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discount_percent: e.target.value,
                  })
                }
                style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit', width: 120 }}
              />
            </div>

            <select
              className="input"
              value={form.allowed_payment_methods[0] || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  allowed_payment_methods: e.target.value
                    ? [e.target.value]
                    : [],
                })
              }
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit' }}
            >
              <option value="">All Payments</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="COD">COD</option>
            </select>

            <label className="coupon-active-toggle">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
              />
              <span className="checkmark" aria-hidden="true" />
              Active
            </label>



            <button
              className="btn primary"
              onClick={createCoupon}
              disabled={saving}
              style={{ width: '100%', padding: '10px 14px' }}
            >
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </div>

        {/* LIST */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="cardTitle">Existing Coupons</h3>

          {loading ? (
            <div>Loading coupons…</div>
          ) : coupons.length === 0 ? (
            <div>No coupons created yet</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                      <th>Discount (₹)</th>
                      <th>Discount (%)</th>
                  <th>Payments</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td>{c.code}</td>
                    <td>₹{c.discount_amount}</td>
                    <td>{c.discount_percent ? `${c.discount_percent}%` : "—"}</td>
                    <td>
                      {c.allowed_payment_methods.length
                        ? c.allowed_payment_methods.join(", ")
                        : "All"}
                    </td>
                    <td>
                      <span
                        className={
                          c.is_active
                            ? "badge success"
                            : "badge danger"
                        }
                      >
                        {c.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap">
                          <button
                            className={`btn toggle ${c.is_active ? 'on' : 'off'}`}
                            onClick={() => toggleCoupon(c)}
                          >
                            {c.is_active ? 'Active' : 'Disabled'}
                          </button>
                          <button
                            className="btn danger"
                            onClick={() => deleteCoupon(c.id)}
                          >
                            Delete
                          </button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
