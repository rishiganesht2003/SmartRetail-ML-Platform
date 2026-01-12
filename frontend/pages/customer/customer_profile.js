"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerNavbar from "@/components/navigation/customer/CustomerNavbar";
import { apiFetch } from "@/lib/api";

export default function CustomerProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState({
    username: "",
    full_name: "",
    email: "",
  });

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const nameRef = useRef();
  const oldPwdRef = useRef();
  const newPwdRef = useRef();
  const confirmPwdRef = useRef();

  /* ======================
     AUTH + LOAD PROFILE
  ====================== */
  useEffect(() => {
    if (!localStorage.getItem("access")) {
      router.replace("/");
      return;
    }
    loadProfile();
  }, [router]);

  async function loadProfile() {
    setLoading(true);
    setError("");

    const res = await apiFetch("/api/accounts/profile/");
    if (res.ok) {
      setProfile(res.data);
    } else {
      setError("Failed to load profile");
    }

    setLoading(false);
  }

  /* ======================
     SAVE PROFILE
  ====================== */
  async function saveProfile(e) {
    e.preventDefault();
    setError("");
    setMsg("");

    const res = await apiFetch("/api/accounts/profile/", {
      method: "PATCH",
      body: {
        full_name: nameRef.current.value.trim(),
      },
    });

    if (res.ok) {
      setMsg("✅ Profile updated successfully");
      setEditing(false);
      loadProfile();
    } else {
      setError("❌ Profile update failed");
    }
  }

  /* ======================
     CHANGE PASSWORD
  ====================== */
  async function changePassword(e) {
    e.preventDefault();
    setError("");
    setMsg("");

    const newPwd = newPwdRef.current.value;
    const confirmPwd = confirmPwdRef.current.value;

    if (newPwd !== confirmPwd) {
      setError("Passwords do not match");
      return;
    }

    const res = await apiFetch("/api/accounts/change_password/", {
      method: "POST",
      body: {
        old_password: oldPwdRef.current.value,
        new_password: newPwd,
      },
    });

    if (res.ok) {
      setMsg("✅ Password updated successfully");
      setChangingPwd(false);
    } else {
      setError("❌ Password update failed");
    }
  }

  /* ======================
     RENDER
  ====================== */
  return (
    <div className="root">
      <CustomerNavbar active="profile" />

      <div className="profilePage">
        <div className="profileContainer">
          <div className="profileHeader">
            <h2>👤 My Profile</h2>
            <div className="subtitle">Manage your account information</div>
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

              <div className="buttonContainer flex gap right">
                <button
                  className="btn ghost"
                  onClick={() => setEditing(true)}
                >
                  ✏️ Edit Profile
                </button>

                <button
                  className="btn ghost"
                  onClick={() => {
                    setError("");
                    setMsg("");
                    setChangingPwd(true);
                  }}
                >
                  🔐 Change Password
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
                <input value={profile.email} disabled />
              </div>

              <div className="buttonContainer flex gap right">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="btn primary">
                  Save Changes
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ======================
         PASSWORD MODAL
      ====================== */}
      {changingPwd && (
        <div className="modalOverlay">
          <form className="modalCard" onSubmit={changePassword}>
            <h3>🔐 Change Password</h3>

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
                onClick={() => setChangingPwd(false)}
              >
                Cancel
              </button>

              <button type="submit" className="btn primary">
                Update Password
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
