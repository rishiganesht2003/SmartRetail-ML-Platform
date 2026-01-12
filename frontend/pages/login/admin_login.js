"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

export default function AdminLoginPage() {
  const [flip, setFlip] = useState(false);

  // LOGIN
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // SIGNUP
  const [fullName, setFullName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [email, setEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const doLogin = async () => {
    if (!username || !password) {
      alert("Enter username and password");
      return;
    }

    const res = await apiFetch("/api/accounts/login/", {
      method: "POST",
      body: { username, password },
    });

    if (!res.ok) {
      alert("Invalid credentials");
      return;
    }

    if (res.data.role !== "admin") {
      alert("This account is not an admin account");
      return;
    }

    localStorage.setItem("access", res.data.access);
    localStorage.setItem("role", res.data.role);

    window.location.href = "/admin/admin_overview";
  };

  const doSignup = async () => {
    if (
      !fullName ||
      !signupUsername ||
      !email ||
      !signupPassword ||
      !confirmPassword
    ) {
      alert("Fill all fields");
      return;
    }

    if (signupPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    const res = await apiFetch("/api/accounts/register/", {
      method: "POST",
      body: {
        username: signupUsername,
        email,
        password: signupPassword,
        full_name: fullName,
        role: "admin",
      },
    });

    if (!res.ok) {
      alert(res.data?.detail || "Admin registration failed");
      return;
    }

    alert("Admin account created. Please login.");
    setFlip(false);
  };

  return (
    <div className="login-page">
      <ThemeToggle />

      <div className="login-wrapper">
        <div className={`login-card ${flip ? "flip" : ""}`}>
          <div className="login-form">
            <div className="login-title">Admin Login</div>

            <input className="login-input" placeholder="Username"
              value={username} onChange={(e) => setUsername(e.target.value)} />

            <input className="login-input" type="password" placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)} />

            <button className="login-button" onClick={doLogin}>Login</button>
            <button className="login-ghost" onClick={() => setFlip(true)}>
              Don’t have an account? Sign Up
            </button>
            <div style={{ borderTop: "1px solid var(--login-border)", margin: "16px 0" }}></div>

            <a href="/login/customer_login" style={{ 
              textAlign: "center", 
              color: "var(--login-primary)", 
              fontSize: "0.9rem", 
              fontWeight: "600",
              textDecoration: "none",
              transition: "opacity 0.25s",
              display: "block",
              padding: "8px 0"
            }} onMouseEnter={(e) => e.target.style.opacity = "0.8"} onMouseLeave={(e) => e.target.style.opacity = "1"}>
              👤 Login as Customer
            </a>          </div>

          <div className="login-form backside">
            <div className="login-title">Create Admin Account</div>

            <input className="login-input" placeholder="Full Name"
              value={fullName} onChange={(e) => setFullName(e.target.value)} />

            <input className="login-input" placeholder="Username"
              value={signupUsername} onChange={(e) => setSignupUsername(e.target.value)} />

            <input className="login-input" type="email" placeholder="Email"
              value={email} onChange={(e) => setEmail(e.target.value)} />

            <input className="login-input" type="password" placeholder="Password"
              value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />

            <input className="login-input" type="password" placeholder="Confirm Password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />

            <button className="login-button" onClick={doSignup}>Sign Up</button>
            <button className="login-ghost" onClick={() => setFlip(false)}>
              Already have an account? Login
            </button>

            <div style={{ borderTop: "1px solid var(--login-border)", margin: "16px 0" }}></div>

            <a href="/login/customer_login" style={{ 
              textAlign: "center", 
              color: "var(--login-primary)", 
              fontSize: "0.9rem", 
              fontWeight: "600",
              textDecoration: "none",
              transition: "opacity 0.25s",
              display: "block",
              padding: "8px 0"
            }} onMouseEnter={(e) => e.target.style.opacity = "0.8"} onMouseLeave={(e) => e.target.style.opacity = "1"}>
              👤 Signup as Customer
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
