// frontend/components/ThemeToggle.js
"use client";

import { useEffect, useState } from "react";
import { getTheme, toggleTheme } from "@/lib/theme";

export default function ThemeToggle() {
  const [theme, setThemeState] = useState("dark");

  useEffect(() => {
    const t = getTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  const onToggle = () => {
    const t = toggleTheme();
    setThemeState(t);
  };

  return (
    <button className="theme-toggle" onClick={onToggle}>
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}
