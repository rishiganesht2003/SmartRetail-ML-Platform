export const THEME_KEY = "theme";

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function getTheme() {
  if (typeof window === "undefined") return "dark";
  return localStorage.getItem(THEME_KEY) || "dark";
}

export function setTheme(theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function toggleTheme() {
  const next = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
