"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

export default function CustomerLoginPage() {
  const [flip, setFlip] = useState(false);

  // ---------- LOGIN ----------
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // ---------- SIGNUP ----------
  const [fullName, setFullName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [email, setEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ---------- LOGIN ----------
  const customerLogin = async () => {
    if (!username || !password) {
      alert("Enter username and password");
      return;
    }

    const res = await apiFetch("/api/accounts/login/", {
      method: "POST",
      body: {
        username,
        password,
      },
    });

    if (!res.ok) {
      alert("Invalid credentials");
      return;
    }

    if (res.data.role !== "customer") {
      alert("This account is not a customer account");
      return;
    }

    // ✅ STORE JWT + ROLE (backend aligned)
    localStorage.setItem("access", res.data.access);
    localStorage.setItem("role", "customer");

    // ✅ POLICY: only first time per customer (per browser)
    const policyKey = `policyAccepted_customer_${username}`;
    const accepted = localStorage.getItem(policyKey);

    if (accepted === "true") {
      window.location.href = "/customer/customer_home";
    } else {
      document.querySelector(".login-card")?.classList.add("hide");
      const modal = document.getElementById("policyModal");
      if (modal) modal.style.display = "flex";
    }
  };

  // ---------- SIGNUP ----------
  const customerSignUp = async () => {
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
        password: signupPassword,
        email,
        full_name: fullName,
        role: "customer",
      },
    });

    if (!res.ok) {
      alert(res.data?.detail || "Signup failed");
      return;
    }

    alert("Customer account created. Please login.");
    setFlip(false);
  };

  // ---------- POLICY ACCEPT ----------
  const acceptPolicies = () => {
    const chk = document.getElementById("agreeBox");
    if (!chk || !chk.checked) {
      alert("Please accept all policies");
      return;
    }

    const policyKey = `policyAccepted_customer_${username}`;
    localStorage.setItem(policyKey, "true");

    const modal = document.getElementById("policyModal");
    if (modal) modal.style.display = "none";

    document.querySelector(".login-card")?.classList.remove("hide");

    window.location.href = "/customer/customer_home";
  };

  return (
    <div className="login-page">
      <ThemeToggle />

      {/* ---------- LOGIN CARD ---------- */}
      <div className="login-wrapper">
        <div className={`login-card ${flip ? "flip" : ""}`}>
          {/* ---------- LOGIN SIDE ---------- */}
          <div className="login-form">
            <div className="login-title">Customer Login</div>

            <input
              className="login-input"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <input
              className="login-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button className="login-button" onClick={customerLogin}>
              Login
            </button>

            <button className="login-ghost" onClick={() => setFlip(true)}>
              Don&apos;t have an account? Sign Up
            </button>

            <div style={{ borderTop: "1px solid var(--login-border)", margin: "16px 0" }}></div>

            <a href="/login/admin_login" style={{ 
              textAlign: "center", 
              color: "var(--login-primary)", 
              fontSize: "0.9rem", 
              fontWeight: "600",
              textDecoration: "none",
              transition: "opacity 0.25s",
              display: "block",
              padding: "8px 0"
            }} onMouseEnter={(e) => e.target.style.opacity = "0.8"} onMouseLeave={(e) => e.target.style.opacity = "1"}>
              🔐 Login as Admin
            </a>
          </div>

          {/* ---------- SIGNUP SIDE ---------- */}
          <div className="login-form backside">
            <div className="login-title">Create Account</div>

            <input
              className="login-input"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <input
              className="login-input"
              placeholder="Username"
              value={signupUsername}
              onChange={(e) => setSignupUsername(e.target.value)}
            />

            <input
              className="login-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="login-input"
              type="password"
              placeholder="Password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
            />

            <input
              className="login-input"
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <button className="login-button" onClick={customerSignUp}>
              Sign Up
            </button>

            <button className="login-ghost" onClick={() => setFlip(false)}>
              Already have an account? Login
            </button>

            <div style={{ borderTop: "1px solid var(--login-border)", margin: "16px 0" }}></div>

            <a href="/login/admin_login" style={{ 
              textAlign: "center", 
              color: "var(--login-primary)", 
              fontSize: "0.9rem", 
              fontWeight: "600",
              textDecoration: "none",
              transition: "opacity 0.25s",
              display: "block",
              padding: "8px 0"
            }} onMouseEnter={(e) => e.target.style.opacity = "0.8"} onMouseLeave={(e) => e.target.style.opacity = "1"}>
              🔐 Signup as Admin
            </a>
          </div>
        </div>
      </div>

      {/* ---------- POLICY MODAL ---------- */}
      <div className="policy-modal" id="policyModal">
        <div className="policy-box">
          <h1>Agreement</h1>

          <h2>About Us</h2>
          <p>
            Smart Retail uses AI-powered recommendations and smart pricing to
            enhance your shopping experience.
          </p>

          <h2>Privacy Policy</h2>
          <p>
            We collect personal data only to process orders and ensure secure
            transactions. Data is never sold.
          </p>

          <h2>Cookie Policy</h2>
          <p>
            Cookies personalize your experience. Disabling them may affect
            functionality.
          </p>

          <h2>Refund &amp; Cancellation</h2>
          <p>
            Orders can be canceled within 24 hours. Refunds are processed
            within 5–7 business days.
          </p>

          <h2>Shipping Policy</h2>
          <p>
            Orders are delivered within 3–7 business days. Tracking details
            are shared.
          </p>

          <h2>Terms &amp; Conditions</h2>
          <p>
            By using Smart Retail, you agree to all policies governing
            platform usage, payments, and returns.
          </p>

          <div className="accept-area">
            <input type="checkbox" id="agreeBox" />
            <label>I have read and agree to all policies</label>
          </div>

          <button className="policy-accept-btn" onClick={acceptPolicies}>
            Accept &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
}
