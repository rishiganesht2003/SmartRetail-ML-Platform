"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTheme, toggleTheme } from "@/lib/theme";

export default function CustomerNavbar({ active }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState("dark"); // default must match SSR

  // ✅ run ONLY on client
  useEffect(() => {
    const t = getTheme();
    setTheme(t);
    // ensure page adopts the theme immediately on mount
    try {
      document.documentElement.setAttribute("data-theme", t);
    } catch (e) {}
    setMounted(true);
  }, []);

  const isActive = (key) =>
    active === key ? "navLink navLinkActive" : "navLink";

  const handleThemeToggle = () => {
    const next = toggleTheme();
    setTheme(next);
    try {
      // persist and ensure CSS selectors apply
      localStorage.setItem("theme", next);
      document.documentElement.setAttribute("data-theme", next);
    } catch (e) {}
  };

  // keep root attribute in sync if theme state changes
  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", theme);
    } catch (e) {}
  }, [theme]);

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem("access");
    window.location.href = "/";
  };

  // ✅ prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <>
      <header className="navbar">
        <div className="navLeft">
          {/* THEME TOGGLE */}
          <button className="themeBtn" onClick={handleThemeToggle}>
            <span className="navIcon">
              {theme === "light" ? "☀️" : "🌙"}
            </span>
          </button>

          <div className="navLogo">Smart Retail</div>

          <nav className="navLinks">
            <Link href="/customer/customer_home" className={isActive("home")}>
              <span className="navIcon">🏠</span>
              <span className="navText">Home</span>
            </Link>

            <Link href="/customer/customer_products" className={isActive("products")}>
              <span className="navIcon">🛍</span>
              <span className="navText">Products</span>
            </Link>

            <Link href="/customer/customer_cart" className={isActive("cart")}>
              <span className="navIcon">🛒</span>
              <span className="navText">Cart</span>
            </Link>

            <Link href="/customer/customer_orders" className={isActive("orders")}>
              <span className="navIcon">📦</span>
              <span className="navText">Orders</span>
            </Link>

            <Link href="/customer/customer_wishlist" className={isActive("wishlist")}>
              <span className="navIcon">❤️</span>
              <span className="navText">Wishlist</span>
            </Link>

            <Link href="/customer/customer_wallet" className={isActive("wallet")}>
              <span className="navIcon">👛</span>
              <span className="navText">Wallet</span>
            </Link>

            <Link href="/customer/customer_profile" className={isActive("profile")}>
              <span className="navIcon">👤</span>
              <span className="navText">Profile</span>
            </Link>

          </nav>
        </div>

        <button className="logoutBtn" onClick={handleLogout}>
          <span className="navIcon">🚪</span>
          <span className="navText">Logout</span>
        </button>
      </header>

      {/* LOGOUT CONFIRMATION DIALOG */}
      {showLogoutDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(12px)" }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "28px", maxWidth: "380px", boxShadow: "0 22px 55px rgba(15, 23, 42, 0.9)", animation: "fadeIn 0.25s ease-out" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "700" }}>Confirm Logout</h3>
            <p style={{ margin: "0 0 24px 0", color: "var(--muted)", fontSize: "14px" }}>Are you sure you want to logout? You'll need to login again to access your account.</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                style={{ flex: 1, padding: "10px 16px", background: "var(--accent)", color: "white", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "14px" }}
                onClick={confirmLogout}
              >
                Yes, Logout
              </button>
              <button
                style={{ flex: 1, padding: "10px 16px", background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "14px" }}
                onClick={() => setShowLogoutDialog(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
