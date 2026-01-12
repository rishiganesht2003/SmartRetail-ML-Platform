"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch } from "@/lib/api";

export default function AdminManageUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdCreds, setCreatedCreds] = useState(null);

  const modalNameRef = useRef();
  const modalEmailRef = useRef();
  const modalRoleRef = useRef();

  /* =========================
     AUTH + LOAD
  ========================= */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      router.replace("/login/admin_login");
      return;
    }
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError("");
    setCreatedCreds(null);

    // role enforcement
    const prof = await apiFetch("/api/accounts/profile/");
    if (!prof.ok || prof.data.role !== "admin") {
      router.replace("/login/admin_login");
      return;
    }

    const params = new URLSearchParams();
    if (q) params.append("q", q);
    if (roleFilter) params.append("role", roleFilter);

    const res = await apiFetch(
      `/api/accounts/users/?${params.toString()}`
    );

    if (!res.ok) {
      setError("Failed to load users");
      setLoading(false);
      return;
    }

    setUsers(res.data || []);
    setLoading(false);
  }

  /* =========================
     MODAL HANDLERS
  ========================= */
  function openAdd() {
    setEditingUser(null);
    setShowModal(true);
    setCreatedCreds(null);

    setTimeout(() => {
      modalNameRef.current.value = "";
      modalEmailRef.current.value = "";
      modalRoleRef.current.value = "customer";
    }, 0);
  }

  function openEdit(user) {
    setEditingUser(user);
    setShowModal(true);
    setCreatedCreds(null);

    setTimeout(() => {
      modalNameRef.current.value = user.name;
      modalEmailRef.current.value = user.email;
      modalRoleRef.current.value = user.role;
    }, 0);
  }

  /* =========================
     SAVE USER
  ========================= */
  async function saveUser(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setCreatedCreds(null);

    const payload = {
      name: modalNameRef.current.value.trim(),
      email: modalEmailRef.current.value.trim(),
      role: modalRoleRef.current.value,
    };

    const res = await apiFetch(
      editingUser
        ? `/api/accounts/users/${editingUser.id}/`
        : `/api/accounts/users/`,
      {
        method: editingUser ? "PATCH" : "POST",
        body: payload,
      }
    );

    if (!res.ok) {
      setError(res.data?.detail || "Save failed");
      setSaving(false);
      return;
    }

    if (!editingUser) {
      setCreatedCreds({
        username: res.data.username,
        password: res.data.password,
      });
    } else {
      setShowModal(false);
    }

    setSaving(false);
    loadUsers();
  }

  /* =========================
     ACTIONS
  ========================= */
  async function toggleActive(user) {
    await apiFetch(`/api/accounts/users/${user.id}/`, {
      method: "PATCH",
      body: { is_active: !user.is_active },
    });
    loadUsers();
  }

  async function deleteUser(user) {
    if (!confirm(`Delete ${user.email}?`)) return;

    await apiFetch(`/api/accounts/users/${user.id}/`, {
      method: "DELETE",
    });

    loadUsers();
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="app-page">
      <AdminSidebar active="admin_manage_users" />

      <main className="main">
        <div className="flex space-between">
          <div>
            <h1 className="pageTitle">Manage Users</h1>
            <p className="pageSubtitle">
              Admin controlled user & role management
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
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit' }}
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="customer">Customer</option>
          </select>
          <button className="btn primary" onClick={loadUsers} style={{ width: '100%' }}>
            Filter
          </button>
          <button className="btn ghost" onClick={openAdd} style={{ width: '100%' }}>
            Add User
          </button>
        </div>

        {error && <div className="errorText">{error}</div>}

        {loading ? (
          <div>Loading users...</div>
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="5">No users found</td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>
                        <button
                          className={`badge ${
                            u.is_active ? "success" : "danger"
                          }`}
                          onClick={() => toggleActive(u)}
                        >
                          {u.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td>
                        <div className="flex gap">
                          <button
                            className="btn ghost"
                            onClick={() => openEdit(u)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn danger"
                            onClick={() => deleteUser(u)}
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

        {/* MODAL */}
        {showModal && (
          <div className="modalOverlay">
            <form className="modalCard" onSubmit={saveUser}>
              <h3>{editingUser ? "Edit User" : "Create User"}</h3>

              <input ref={modalNameRef} placeholder="Name" required />
              <input
                ref={modalEmailRef}
                placeholder="Email"
                type="email"
                required
              />
              <select ref={modalRoleRef}>
                <option value="admin">Admin</option>
                <option value="customer">Customer</option>
              </select>

              {createdCreds && (
                <div className="card" style={{ marginTop: 10 }}>
                  <b>Username:</b> {createdCreds.username}
                  <br />
                  <b>Password:</b> {createdCreds.password}
                </div>
              )}

              <div className="flex gap right">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button className="btn primary" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
