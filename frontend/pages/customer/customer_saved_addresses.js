"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProductDetailsNavbar from "@/components/navigation/customer/ProductDetailsNavbar";
import { apiFetch } from "@/lib/api";

export default function CustomerSavedAddressesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    address_line: "",
    city: "",
    pincode: "",
    phone: "",
    is_default: false,
  });

  /* ======================
     AUTH + LOAD ADDRESSES
  ====================== */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      router.replace("/");
      return;
    }
    loadAddresses();
  }, [router]);

  const loadAddresses = async () => {
    setLoading(true);
    setError("");

    const res = await apiFetch("/api/core/customer/addresses/");
    if (!res.ok) {
      setError("Failed to load addresses");
      setLoading(false);
      return;
    }

    const data = res.data || [];
    setAddresses(data);

    // auto-select default
    const def = data.find((a) => a.is_default);
    if (def) {
      setSelectedId(def.id);
      localStorage.setItem("selectedAddress", JSON.stringify(def));
    }

    setLoading(false);
  };

  /* ======================
     EDIT ADDRESS
  ====================== */
  const editAddress = (addr) => {
    setEditingId(addr.id);
    setForm({
      name: addr.name || "",
      address_line: addr.address_line || "",
      city: addr.city || "",
      pincode: addr.pincode || "",
      phone: addr.phone || "",
      is_default: !!addr.is_default,
    });
    setShowForm(true);
    setSelectedId(addr.id);
  };

  /* ======================
     DELETE ADDRESS
  ====================== */
  const deleteAddress = async (addrId) => {
    if (!confirm("Delete this address?")) return;

    const res = await apiFetch(`/api/core/customer/addresses/${addrId}/`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setError("Failed to delete address");
      return;
    }

    // clear selected if it was deleted
    if (selectedId === addrId) {
      setSelectedId(null);
      localStorage.removeItem("selectedAddress");
    }

    loadAddresses();
  };

  /* ======================
     SELECT ADDRESS
  ====================== */
  const selectAddress = (addr) => {
    setSelectedId(addr.id);
    localStorage.setItem("selectedAddress", JSON.stringify(addr));
  };

  /* ======================
     SAVE ADDRESS
  ====================== */
  const saveAddress = async () => {
    setError("");

    if (
      !form.name ||
      !form.phone ||
      !form.address_line ||
      !form.city ||
      !form.pincode
    ) {
      setError("Please fill all fields");
      return;
    }

    let res;
    if (editingId) {
      res = await apiFetch(`/api/core/customer/addresses/${editingId}/`, {
        method: "PUT",
        body: form,
      });
    } else {
      res = await apiFetch("/api/core/customer/addresses/", {
        method: "POST",
        body: form,
      });
    }

    if (!res.ok) {
      setError("Failed to save address");
      return;
    }

    setShowForm(false);
    setForm({
      name: "",
      address_line: "",
      city: "",
      pincode: "",
      phone: "",
      is_default: false,
    });

    setEditingId(null);

    loadAddresses();
  };

  /* ======================
     UI STATES
  ====================== */
  if (loading) {
    return <div className="page">Loading addresses…</div>;
  }

  return (
    <div className="root">
      <ProductDetailsNavbar />

      <div className="page">
        <h2 className="sectionTitle">📍 Select Delivery Address</h2>

        {error && <div className="errorText">{error}</div>}

        {/* ================= EMPTY ================= */}
        {addresses.length === 0 && !showForm && (
          <div className="emptyState">
            <p>No saved addresses found.</p>
            <button
              className="btn"
              onClick={() => setShowForm(true)}
            >
              ➕ Add New Address
            </button>
          </div>
        )}

        {/* ================= ADDRESS LIST ================= */}
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className={`addrCard ${
              selectedId === addr.id ? "active" : ""
            }`}
            onClick={() => selectAddress(addr)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="name">{addr.name}</div>
                <div className="text">
                  {addr.address_line}, {addr.city} – {addr.pincode}
                </div>
                <div className="phone">📞 {addr.phone}</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  className="btnOutline"
                  onClick={(e) => {
                    e.stopPropagation();
                    editAddress(addr);
                  }}
                >
                  Update
                </button>

                <button
                  className="btnGhost"
                  style={{ background: "#ffdddd", border: "1px solid #ffaaaa" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAddress(addr.id);
                  }}
                >
                  Remove
                </button>

                {addr.is_default && (
                  <div className="badge" style={{ marginTop: 4 }}>
                    Default
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* ================= ADD BUTTON ================= */}
        {addresses.length > 0 && !showForm && (
          <button
            className="btnOutline"
            onClick={() => setShowForm(true)}
          >
            ➕ Add New Address
          </button>
        )}

        {/* ================= FORM ================= */}
        {showForm && (
          <div className="addressForm">
            <input
              placeholder="Full Name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
            />
            <input
              placeholder="Address"
              value={form.address_line}
              onChange={(e) =>
                setForm({
                  ...form,
                  address_line: e.target.value,
                })
              }
            />
            <input
              placeholder="City"
              value={form.city}
              onChange={(e) =>
                setForm({ ...form, city: e.target.value })
              }
            />
            <div className="rowPincode">
              <input
                className="pincodeInput"
                placeholder="Pincode"
                value={form.pincode}
                onChange={(e) =>
                  setForm({ ...form, pincode: e.target.value })
                }
              />

              <label
                className="checkboxInline"
                onClick={() =>
                  setForm({ ...form, is_default: !form.is_default })
                }
              >
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      is_default: e.target.checked,
                    })
                  }
                />
                Set as default
              </label>
            </div>

            <div className="formActions">
              <button className="btnPrimary" onClick={saveAddress}>
                Save Address
              </button>
              <button
                className="btnOutline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ================= CONTINUE ================= */}
        {addresses.length > 0 && (
          <button
            className="btnPrimary"
            disabled={!selectedId}
            onClick={() =>
              router.push("/customer/customer_review_order")
            }
          >
            Review Order →
          </button>
        )}
      </div>
    </div>
  );
}
