"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "thundercrew-sidebar-collapsed";

type SidebarState = "collapsed" | "expanded";

function applySidebarState(state: SidebarState) {
  document.documentElement.dataset.sidebar = state;
}

function readSidebarState(): SidebarState {
  if (typeof window === "undefined") return "expanded";
  const state = window.localStorage.getItem(STORAGE_KEY) === "true" ? "collapsed" : "expanded";
  applySidebarState(state);
  return state;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("thundercrew-sidebar-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("thundercrew-sidebar-change", onStoreChange);
  };
}

export function SidebarToggle() {
  const sidebarState = useSyncExternalStore(subscribe, readSidebarState, () => "expanded");
  const collapsed = sidebarState === "collapsed";

  function toggle() {
    const nextCollapsed = !collapsed;
    window.localStorage.setItem(STORAGE_KEY, String(nextCollapsed));
    applySidebarState(nextCollapsed ? "collapsed" : "expanded");
    window.dispatchEvent(new Event("thundercrew-sidebar-change"));
  }

  return (
    <button
      type="button"
      className="sidebar-toggle"
      aria-label={collapsed ? "사이드바 펼치기" : "사이드바 완전히 접기"}
      aria-pressed={collapsed}
      onClick={toggle}
    >
      <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
    </button>
  );
}
