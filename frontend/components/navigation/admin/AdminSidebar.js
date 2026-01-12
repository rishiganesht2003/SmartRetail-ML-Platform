"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTheme, toggleTheme } from "@/lib/theme";

export default function AdminSidebar({ active }) {
  const router = useRouter();

  /* =========================
     SIDEBAR STATE (PERSISTENT)
  ========================= */
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("adminSidebarCollapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      localStorage.setItem("adminSidebarCollapsed", !prev);
      return !prev;
    });
  };

  /* =========================
     THEME
  ========================= */
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const current = getTheme();
    setTheme(current);
    // ensure root data-theme is set so CSS [data-theme="light"] rules apply
    try {
      document.documentElement.setAttribute("data-theme", current);
    } catch (e) {}
  }, []);

  const onThemeToggle = () => {
    const next = toggleTheme(); // toggleTheme should return new theme (light/dark)
    setTheme(next);
    // persist admin-specific theme key and set root attribute
    try {
      localStorage.setItem("adminTheme", next);
      document.documentElement.setAttribute("data-theme", next);
    } catch (e) {}
  };

  // keep root attribute in sync if theme changes elsewhere
  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("adminTheme", theme);
    } catch (e) {}
  }, [theme]);

  const themeIcon = theme === "dark" ? "🌙" : "☀️";

  /* =========================
     HELPERS
  ========================= */
  const isActive = (page) =>
    active === page ? "menuLink menuActive" : "menuLink";

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("adminTheme");
    localStorage.removeItem("adminSidebarCollapsed");
    router.replace("/");
  };

  const label = (icon, text) =>
    isCollapsed ? icon : `${icon} ${text}`;

  /* =========================
     UI
  ========================= */
  return (
    <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      {/* ===== TOP BAR ===== */}
      <div className="topRow">
        <button
          className={`collapseBtn ${isCollapsed ? "collapsedBtn" : ""}`}
          onClick={toggleSidebar}
          title="Toggle sidebar"
        >
          ☰
        </button>

        {!isCollapsed && (
          <h1 className="sidebarTitle">Analytics Hub</h1>
        )}

        <button
          className={`themeCircle ${isCollapsed ? "collapsedTheme" : ""}`}
          onClick={onThemeToggle}
          title="Toggle theme"
        >
          {themeIcon}
        </button>
      </div>

      {/* ===== MENU ===== */}
      <nav className="menu">
        {/* CORE */}
        <Link title="Overview" href="/admin/admin_overview" className={isActive("admin_overview")}>
          {label("🏠", "Overview")}
        </Link>

        <Link title="Reports" href="/admin/admin_reports" className={isActive("admin_reports")}>
          {label("📊", "Reports")}
        </Link>

        {/* ORDERS & OPS */}
        <Link title="Orders" href="/admin/admin_orders" className={isActive("admin_orders")}>
          {label("🧾", "Orders")}
        </Link>

            

      

        <Link title="Inventory Optimization" href="/admin/admin_inventory_optimization" className={isActive("admin_inventory_optimization")}>
          {label("📦", "Inventory Optimization")}
        </Link>

        <Link title="Manage Products" href="/admin/admin_manage_products" className={isActive("admin_manage_products")}>
          {label("🛍️", "Manage Products")}
        </Link>

        {/* PRICING & CUSTOMERS */}
        <Link title="Dynamic Pricing" href="/admin/admin_dynamic_pricing" className={isActive("admin_dynamic_pricing")}>
          {label("💰", "Dynamic Pricing")}
        </Link>


          <Link
        title="Manage Coupons"
        href="/admin/admin_manage_coupons"
        className={isActive("admin_manage_coupons")}
      >
        {label("🏷️", "Manage Coupons")}
      </Link>

        <Link title="Customer Segments" href="/admin/admin_customer_segmentation" className={isActive("admin_customer_segmentation")}>
          {label("👥", "Customer Segments")}
        </Link>

        <Link title="Recommendation Engine" href="/admin/admin_recommendations" className={isActive("admin_recommendation_engine")}>
          {label("🤖", "Recommendation Engine")}
        </Link>

        {/* ML / INTELLIGENCE */}
        <Link title="Sales Forecasting" href="/admin/admin_sales_forecasting" className={isActive("admin_sales_forecasting")}>
          {label("📈", "Sales Forecasting")}
        </Link>

        <Link title="Seasonal Trends" href="/admin/admin_seasonal_trends" className={isActive("admin_seasonal_trends")}>
          {label("📅", "Seasonal Trends")}
        </Link>

        <Link title="Automation Center" href="/admin/admin_automation_center" className={isActive("admin_automation_center")}>
          {label("🔄", "Automation Center")}
        </Link>

        {/* ADMIN */}
        <Link title="Manage Users" href="/admin/admin_manage_users" className={isActive("admin_manage_users")}>
          {label("👤", "Manage Users")}
        </Link>

        <Link title="Profile" href="/admin/admin_profile" className={isActive("admin_profile")}>
          {label("🧑‍💼", "Profile")}
        </Link>
      </nav>

      {/* ===== LOGOUT ===== */}
      <button className="logoutBtn" onClick={handleLogout} title="Logout">
        {isCollapsed ? "🚪" : "🚪 Logout"}
      </button>

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
    </aside>
  );
}
