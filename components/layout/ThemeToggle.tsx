"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "thundercrew-theme";
type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  const theme = saved === "light" || saved === "dark" ? saved : getSystemTheme();
  applyTheme(theme);
  return theme;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("thundercrew-theme-change", onStoreChange);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("thundercrew-theme-change", onStoreChange);
    media.removeEventListener("change", onStoreChange);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light");
  const isDark = theme === "dark";

  function toggle() {
    const next = isDark ? "light" : "dark";
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    window.dispatchEvent(new Event("thundercrew-theme-change"));
  }

  return (
    <button type="button" className="sidebar-link theme-toggle" aria-pressed={isDark} onClick={toggle} title="다크모드 전환">
      <span className="sidebar-icon">{isDark ? "☾" : "☀"}</span>
      <span className="sidebar-label">{isDark ? "다크모드" : "라이트모드"}</span>
    </button>
  );
}
