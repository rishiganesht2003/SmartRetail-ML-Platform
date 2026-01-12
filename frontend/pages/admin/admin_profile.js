"use client";

import { useEffect, useState, useRef } from "react";
import AdminSidebar from "@/components/navigation/admin/AdminSidebar";
import { apiFetch } from "@/lib/api";

export default function AdminProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [profile, setProfile] = useState({
    username: "",
    email: "",
    full_name: "",
    role: "",
    is_active: true,
  });

  const nameRef = useRef();
  const emailRef = useRef();

  const oldPwdRef = useRef();
  const newPwdRef = useRef();
  const confirmPwdRef = useRef();

  /* =========================
     AUTH + LOAD PROFILE
  ========================= */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      window.location.href = "/login/admin_login";
      return;
    }
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError("");

    const res = await apiFetch("/api/accounts/profile/");
    if (!res.ok || res.data.role !== "admin") {
      localStorage.clear();
      window.location.href = "/login/admin_login";
      return;
    }

    setProfile(res.data);
    setLoading(false);
  }

  /* =========================
     SAVE PROFILE
  ========================= */
  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");

    const res = await apiFetch("/api/accounts/profile/", {
      method: "PATCH",
      body: {
        full_name: nameRef.current.value.trim(),
        email: emailRef.current.value.trim(),
      },
    });

    if (!res.ok) {
      setError("Profile update failed");
      setSaving(false);
      return;
    }

    setMsg("Profile updated successfully");
    setEditing(false);
    setSaving(false);
    loadProfile();
  }

  /* =========================
     CHANGE PASSWORD
  ========================= */
  async function changePassword(e) {
    e.preventDefault();
    setPwdSaving(true);
    setError("");
    setMsg("");

    const oldPassword = oldPwdRef.current.value;
    const newPassword = newPwdRef.current.value;
    const confirmPassword = confirmPwdRef.current.value;

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setPwdSaving(false);
      return;
    }

    const res = await apiFetch("/api/accounts/change_password/", {
      method: "POST",
      body: {
        old_password: oldPassword,
        new_password: newPassword,
      },
    });

    if (!res.ok) {
      setError("Password change failed");
      setPwdSaving(false);
      return;
    }

    // clear fields
    oldPwdRef.current.value = "";
    newPwdRef.current.value = "";
    confirmPwdRef.current.value = "";

    setMsg("Password changed successfully");
    setShowPwdModal(false);
    setPwdSaving(false);
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="app-page">
      <AdminSidebar active="admin_profile" />

      <div className="profilePage">
        <div className="profileContainer">
          <div className="profileHeader">
            <h2>My Profile</h2>
            <div className="subtitle">Account information & security</div>
          </div>

          {loading && <div className="profileForm"><div className="loadingState">Loading profile…</div></div>}
          {error && <div className="errorText">{error}</div>}
          {msg && <div className="successText">{msg}</div>}

          {!loading && !editing && (
            <div className="profileForm">
              <div className="detailRow">
                <b>Username:</b>
                <span>{profile.username}</span>
              </div>

              <div className="detailRow">
                <b>Full Name:</b>
                <span>{profile.full_name}</span>
              </div>

              <div className="detailRow">
                <b>Email:</b>
                <span>{profile.email}</span>
              </div>

              <div className="detailRow">
                <b>Role:</b>
                <span>{profile.role}</span>
              </div>

              <div className="buttonContainer flex gap right">
                <button
                  className="btn ghost"
                  onClick={() => setEditing(true)}
                >
                  Edit Profile
                </button>

                <button
                  className="btn ghost"
                  onClick={() => setShowPwdModal(true)}
                >
                  Change Password
                </button>
              </div>
            </div>
          )}

          {!loading && editing && (
            <form className="profileForm" onSubmit={saveProfile}>
              <div>
                <label>Full Name</label>
                <input
                  ref={nameRef}
                  defaultValue={profile.full_name}
                  required
                />
              </div>

              <div>
                <label>Email</label>
                <input
                  ref={emailRef}
                  defaultValue={profile.email}
                  type="email"
                  required
                />
              </div>

              <div>
                <label>Role</label>
                <input value={profile.role} disabled />
              </div>

              <div className="buttonContainer flex gap right">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ======================
         PASSWORD MODAL
      ====================== */}
      {showPwdModal && (
        <div className="modalOverlay">
          <form className="modalCard" onSubmit={changePassword}>
            <h3>Change Password</h3>

            <input
              type="password"
              placeholder="Current password"
              ref={oldPwdRef}
              required
            />

            <input
              type="password"
              placeholder="New password"
              ref={newPwdRef}
              required
            />

            <input
              type="password"
              placeholder="Confirm password"
              ref={confirmPwdRef}
              required
            />

            <div className="flex gap right" style={{ marginTop: '8px' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setShowPwdModal(false)}
              >
                Cancel
              </button>

              <button type="submit" className="btn primary" disabled={pwdSaving}>
                {pwdSaving ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
