"use client";

import { useEffect, useState } from "react";
import { toggleTheme, getTheme } from "@/lib/theme";

export default function ProductDetailsNavbar() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const t = getTheme();
    setTheme(t);
    try {
      document.documentElement.setAttribute("data-theme", t);
    } catch (e) {}
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const next = toggleTheme();
    setTheme(next);
    try {
      localStorage.setItem("theme", next);
      document.documentElement.setAttribute("data-theme", next);
    } catch (e) {}
  };

  if (!mounted) return null;

  return (
    <div className="detailsNavbar">
      <div className="navLeft">
        <button className="themeBtn" onClick={handleToggle} aria-label="Toggle theme">
          {theme === "light" ? "☀️" : "🌙"}
        </button>
        <div className="navLogo">Smart Retail</div>
      </div>

      <button className="backBtn" onClick={() => window.history.back()}>
        ⬅ Back
      </button>
    </div>
  );
}
