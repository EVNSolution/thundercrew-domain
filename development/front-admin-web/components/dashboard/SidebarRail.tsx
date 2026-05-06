"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { sidebarManagementItems } from "@/lib/navigation/management-navigation";

const STORAGE_KEY = "thundercrew-theme";
type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "light" || saved === "dark" ? saved : getSystemTheme();
}

function subscribeTheme(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  window.addEventListener("thundercrew-theme-change", onChange);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("thundercrew-theme-change", onChange);
    media.removeEventListener("change", onChange);
  };
}

interface RailItem {
  id: string;
  href: string;
  label: string;
  icon: string;
}

const PRIMARY_RAIL_ITEMS: RailItem[] = [
  { id: "dashboard", href: "/dashboard", label: "지도 관제", icon: "⌖" },
  ...sidebarManagementItems.map((item) => ({
    id: item.href.replace(/^\//, "").replace(/\//g, "-"),
    href: item.href,
    label: item.label,
    icon: item.icon,
  })),
];

const UTILITY_RAIL_ITEMS: RailItem[] = [
  { id: "integrity", href: "/integrity", label: "무결성 점검", icon: "△" },
  { id: "settings", href: "/settings", label: "설정", icon: "⚙" },
];

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarRail() {
  const pathname = usePathname();
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as const);
  const isDark = theme === "dark";

  function toggleTheme() {
    if (typeof window === "undefined") return;
    const next: Theme = isDark ? "light" : "dark";
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event("thundercrew-theme-change"));
  }

  return (
    <nav className="rm-sidebar-rail" aria-label="대시보드 사이드바">
      <ul className="rm-sidebar-rail-list">
        {PRIMARY_RAIL_ITEMS.map((item) => {
          const active = isItemActive(pathname, item.href);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`rm-sidebar-rail-item${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={item.label}
              >
                <span className="rm-sidebar-rail-item-icon" aria-hidden="true">{item.icon}</span>
                <span className="sr-only">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <ul className="rm-sidebar-rail-list rm-sidebar-rail-list-utility">
        {UTILITY_RAIL_ITEMS.map((item) => {
          const active = isItemActive(pathname, item.href);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`rm-sidebar-rail-item${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={item.label}
              >
                <span className="rm-sidebar-rail-item-icon" aria-hidden="true">{item.icon}</span>
                <span className="sr-only">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="rm-sidebar-rail-footer">
        <button
          type="button"
          className="rm-sidebar-rail-theme"
          aria-pressed={isDark}
          title={isDark ? "라이트모드 전환" : "다크모드 전환"}
          onClick={toggleTheme}
        >
          <span aria-hidden="true">{isDark ? "☾" : "☀"}</span>
          <span className="sr-only">{isDark ? "라이트모드 전환" : "다크모드 전환"}</span>
        </button>
      </div>
    </nav>
  );
}
