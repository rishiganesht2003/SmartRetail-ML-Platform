"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch, API_URL } from "@/lib/api";

export default function AdminManageProductsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nameRef = useRef();
  const categoryRef = useRef();
  const priceRef = useRef();
  const stockRef = useRef();
  const descRef = useRef();
  const fileRef = useRef();
  const previewRef = useRef();

  /* =========================
     AUTH + LOAD PRODUCTS
  ========================= */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      router.replace("/login/admin_login");
      return;
    }
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError("");

    // role enforcement
    const prof = await apiFetch("/api/accounts/profile/");
    if (!prof.ok || prof.data.role !== "admin") {
      router.replace("/login/admin_login");
      return;
    }

    const params = new URLSearchParams();
    if (q) params.append("q", q);
    if (categoryFilter) params.append("category", categoryFilter);

    const res = await apiFetch(
      `/api/catalog/admin/products/?${params.toString()}`
    );

    if (!res.ok) {
      setError("Failed to load products");
      setLoading(false);
      return;
    }

    setProducts(res.data || []);
    setLoading(false);
  }

  /* =========================
      OPEN ADD MODAL
  ========================= */
  function openAddModal() {
    setShowAddModal(true);
    setError("");

    setTimeout(() => {
      nameRef.current.value = "";
      categoryRef.current.value = "";
      priceRef.current.value = "";
      stockRef.current.value = "";
      descRef.current.value = "";
      fileRef.current.value = "";
      if (previewRef.current) previewRef.current.src = "";
    }, 0);
  }

  /* =========================
     OPEN EDIT MODAL (moved from standalone admin_edit_product)
  ========================= */
  function openEditModal(id) {
    setEditingId(id);
    // ensure add modal is closed when opening edit
    setShowAddModal(false);
    setShowEditModal(true);
    setEditLoading(true);
    setError("");

    // Clear previews immediately
    setTimeout(() => {
      if (previewRef.current) previewRef.current.src = "";
      if (fileRef.current) fileRef.current.value = "";
    }, 0);

    loadEditProduct(id);
  }

  async function loadEditProduct(id) {
    setEditLoading(true);
    setError("");

    const res = await apiFetch(`/api/catalog/admin/products/${id}/`);
    if (!res.ok) {
      setError("Failed to load product");
      setEditLoading(false);
      return;
    }

    const data = res.data || {};
    setCurrentProduct(data);

    // allow modal to render first, then populate refs so inputs are mounted
    setEditLoading(false);

    // Ensure inputs are mounted and painted before writing to refs
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (nameRef.current) {
          nameRef.current.value = data.name || "";
          try { nameRef.current.focus(); } catch {}
        }
        if (categoryRef.current) categoryRef.current.value = data.category || "";
        if (priceRef.current) priceRef.current.value = data.price ?? 0;
        if (stockRef.current) stockRef.current.value = data.stock ?? 0;
        if (descRef.current) descRef.current.value = data.description || "";

        if (previewRef.current) {
          previewRef.current.src = data.image
            ? data.image.startsWith("http")
              ? data.image
              : `${API_URL}${data.image}`
            : "";
        }
      });
    });
  }

  async function saveEditedProduct(e) {
    e.preventDefault();
    setEditSaving(true);
    setError("");

    if (!nameRef.current.value.trim()) {
      setError("Product name is required");
      setEditSaving(false);
      return;
    }

    const hasImage = fileRef.current && fileRef.current.files[0];

    let res;
    if (hasImage) {
      // Two-step: PATCH JSON first (so numeric types are preserved), then upload image
      const jsonBody = {
        name: nameRef.current.value.trim(),
        category: categoryRef.current.value.trim(),
        price: parseFloat(priceRef.current.value) || 0,
        stock: parseInt(stockRef.current.value) || 0,
        description: descRef.current.value.trim(),
      };

      // Update numeric/text fields first
      res = await apiFetch(`/api/catalog/admin/products/${editingId}/`, {
        method: "PATCH",
        body: jsonBody,
      });

      if (res.ok) {
        // now upload image separately
        const fd = new FormData();
        fd.append("image", fileRef.current.files[0]);

        const res2 = await apiFetch(`/api/catalog/admin/products/${editingId}/`, {
          method: "PATCH",
          body: fd,
          isFormData: true,
        });

        // prefer latest response if provided
        if (res2.ok && res2.data) res.data = res2.data;
        else if (!res2.ok) {
          // image upload failed; surface error but continue
          setError(res2.data?.detail || "Image upload failed");
        }
      }
    } else {
      // send JSON so numeric types are preserved by DRF
      const body = {
        name: nameRef.current.value.trim(),
        category: categoryRef.current.value.trim(),
        price: parseFloat(priceRef.current.value) || 0,
        stock: parseInt(stockRef.current.value) || 0,
        description: descRef.current.value.trim(),
      };

      res = await apiFetch(`/api/catalog/admin/products/${editingId}/`, {
        method: "PATCH",
        body,
      });
    }

    console.log("saveEditedProduct response:", res);

    if (!res.ok) {
      setError(res.data?.detail || JSON.stringify(res.data) || "Save failed");
      setEditSaving(false);
      return;
    }

    // If backend returned updated product, update preview immediately
    if (res.data) {
      setCurrentProduct(res.data);
      if (res.data.image && previewRef.current) {
        previewRef.current.src = res.data.image.startsWith("http") ? res.data.image : `${API_URL}${res.data.image}`;
      }
    }

    setShowEditModal(false);
    setEditSaving(false);
    // refresh list to reflect updated values across pages
    await loadProducts();
  }

  async function deleteProductFromModal() {
    if (!currentProduct) return;
    if (!confirm("Delete this product?")) return;

    const res = await apiFetch(`/api/catalog/admin/products/${currentProduct.id}/`, { method: "DELETE" });
    if (!res.ok) {
      setError("Delete failed");
      return;
    }

    setShowEditModal(false);
    loadProducts();
  }

  /* =========================
     IMAGE PREVIEW
  ========================= */
  function handleFilePreview(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    previewRef.current.src = URL.createObjectURL(file);
  }

  /* =========================
     CREATE PRODUCT
  ========================= */
  async function addProduct(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const hasImage = fileRef.current && fileRef.current.files[0];
    let res;
    if (hasImage) {
      const fd = new FormData();
      fd.append("name", nameRef.current.value.trim());
      fd.append("category", categoryRef.current.value.trim());
      fd.append("price", priceRef.current.value || 0);
      fd.append("stock", stockRef.current.value || 0);
      fd.append("description", descRef.current.value.trim());
      fd.append("image", fileRef.current.files[0]);

      res = await apiFetch("/api/catalog/admin/products/", {
        method: "POST",
        body: fd,
        isFormData: true,
      });
    } else {
      const body = {
        name: nameRef.current.value.trim(),
        category: categoryRef.current.value.trim(),
        price: parseFloat(priceRef.current.value) || 0,
        stock: parseInt(stockRef.current.value) || 0,
        description: descRef.current.value.trim(),
      };

      res = await apiFetch("/api/catalog/admin/products/", {
        method: "POST",
        body,
      });
    }

    if (!res.ok) {
      setError(res.data?.detail || "Product creation failed");
      setSaving(false);
      return;
    }

    setShowAddModal(false);
    setSaving(false);
    loadProducts();
  }

  /* =========================
     DELETE PRODUCT
  ========================= */
  async function deleteProduct(product) {
    if (!confirm(`Delete "${product.name}"?`)) return;

    const res = await apiFetch(
      `/api/catalog/admin/products/${product.id}/`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      setError("Delete failed");
      return;
    }

    loadProducts();
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="app-page">
      <AdminSidebar active="admin_manage_products" />

      <main className="main">
        <div className="flex space-between">
          <div>
            <h1 className="pageTitle">Manage Products</h1>
            <p className="pageSubtitle">
              Admin-controlled catalog management
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '14px',
          marginBottom: '24px'
        }}>
          <input
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--text)' }}
          />
          <input
            placeholder="Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--text)' }}
          />
          <button className="btn primary" onClick={loadProducts} style={{ width: '100%' }}>
            Filter
          </button>
          <button className="btn ghost" onClick={openAddModal} style={{ width: '100%' }}>
            Add Product
          </button>
        </div>

        {error && <div className="errorText">{error}</div>}

        {loading ? (
          <div>Loading products…</div>
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price (₹)</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="6">No products found</td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.image && (
                          <img
                            src={p.image}
                            alt={p.name}
                            style={{
                              width: 60,
                              height: 60,
                              objectFit: "cover",
                              borderRadius: 6,
                            }}
                          />
                        )}
                      </td>
                      <td>{p.name}</td>
                      <td>{p.category}</td>
                      <td>₹{p.price}</td>
                      <td>{p.stock}</td>
                      <td>
                        <div className="flex gap">
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => openEditModal(p.id)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn danger"
                            onClick={() => deleteProduct(p)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ADD PRODUCT MODAL */}
        {showAddModal && (
          <div className="modalOverlay">
            <form className="modalCard" onSubmit={addProduct}>
              <h3>Create Product</h3>

              <input ref={nameRef} placeholder="Name" required />
              <input ref={categoryRef} placeholder="Category" />
              <input
                ref={priceRef}
                type="number"
                step="0.01"
                placeholder="Price"
              />
              <input
                ref={stockRef}
                type="number"
                placeholder="Stock"
              />
              <textarea ref={descRef} placeholder="Description" />

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFilePreview}
              />

              <img
                ref={previewRef}
                style={{ maxWidth: 180, borderRadius: 8 }}
              />

              <div className="flex gap right">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button className="btn primary" disabled={saving}>
                  {saving ? "Saving..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* EDIT PRODUCT MODAL */}
        {showEditModal && (
          <div
            className="modalOverlay"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-product-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowEditModal(false);
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowEditModal(false);
            }}
          >
            <form className="modalCard" onSubmit={saveEditedProduct}>
              <h3 id="edit-product-title">{editLoading ? "Loading..." : "Edit Product"}</h3>

              {error && <div className="errorText">{error}</div>}

              {editLoading ? (
                <div>Loading…</div>
              ) : (
                <>
                  <input ref={nameRef} placeholder="Name" required />
                  <input ref={categoryRef} placeholder="Category" />
                  <input
                    ref={priceRef}
                    type="number"
                    step="0.01"
                    placeholder="Price"
                  />
                  <input
                    ref={stockRef}
                    type="number"
                    placeholder="Stock"
                  />
                  <textarea ref={descRef} placeholder="Description" />

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFilePreview}
                  />

                  <img
                    ref={previewRef}
                    alt="preview"
                    style={{ maxWidth: 220, borderRadius: 8 }}
                  />

                  <div className="flex gap right" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setShowEditModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={deleteProductFromModal}
                    >
                      Delete
                    </button>
                    <button className="btn primary" disabled={editSaving}>
                      {editSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
