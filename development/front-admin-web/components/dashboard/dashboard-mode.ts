"use client";

// Hash-route synchronised viewport mode for /dashboard.
// Mirrors the four states defined in designs/rider-position-monitor.pen:
//   #/live           — default rider monitor with detail panel available
//   #/panel-closed   — detail panel hidden, map + search visible
//   #/map-zone       — zone polygon + summary panel
//   #/fullscreen     — map only, sidebar/search/detail hidden

export const DASHBOARD_MODES = ["live", "panel-closed", "map-zone", "fullscreen"] as const;
export type DashboardMode = (typeof DASHBOARD_MODES)[number];

export const DEFAULT_DASHBOARD_MODE: DashboardMode = "live";

const HASH_PREFIX = "#/";

function isDashboardMode(value: string): value is DashboardMode {
  return (DASHBOARD_MODES as readonly string[]).includes(value);
}

export function readDashboardMode(): DashboardMode {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_MODE;
  const raw = window.location.hash.startsWith(HASH_PREFIX)
    ? window.location.hash.slice(HASH_PREFIX.length)
    : window.location.hash.replace(/^#/, "");
  return isDashboardMode(raw) ? raw : DEFAULT_DASHBOARD_MODE;
}

export function subscribeDashboardMode(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function applyDashboardMode(next: DashboardMode): void {
  if (typeof window === "undefined") return;
  if (next === DEFAULT_DASHBOARD_MODE) {
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    return;
  }
  window.location.hash = `/${next}`;
}
