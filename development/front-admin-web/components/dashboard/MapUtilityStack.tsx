"use client";

import { applyDashboardMode, type DashboardMode } from "@/components/dashboard/dashboard-mode";

export function MapUtilityStack({ mode }: { mode: DashboardMode }) {
  const isFullscreen = mode === "fullscreen";

  return (
    <div className="map-utility-stack" role="group" aria-label="지도 보조 컨트롤">
      <div className="map-utility-scale" aria-hidden="true">
        <span className="map-utility-scale-bar" />
        <span className="map-utility-scale-label">1 km</span>
      </div>
      <button
        type="button"
        className="map-utility-fullscreen"
        aria-pressed={isFullscreen}
        title={isFullscreen ? "전체화면 종료" : "전체화면 열기"}
        onClick={() => applyDashboardMode(isFullscreen ? "live" : "fullscreen")}
      >
        <span aria-hidden="true">{isFullscreen ? "⤬" : "⛶"}</span>
        <span className="sr-only">{isFullscreen ? "전체화면 종료" : "전체화면"}</span>
      </button>
    </div>
  );
}
