"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getRegisteredMap,
  subscribeRegisteredMap,
} from "@/lib/dashboard/map-registry";
import type { LatLngPath } from "@/lib/dashboard/region-zones";

type Theme = "light" | "dark";

function readDocumentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribeTheme(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("thundercrew-theme-change", onChange);
  return () => window.removeEventListener("thundercrew-theme-change", onChange);
}

// Hex/rgba colours mirror the .pen accent tokens. NCP Polygon takes literal
// strings, so we cannot read CSS variables here.
const POLYGON_PALETTE: Record<Theme, { fill: string; fillOpacity: number; stroke: string; strokeOpacity: number }> = {
  light: { fill: "#3B82F6", fillOpacity: 0.18, stroke: "#3B82F6", strokeOpacity: 0.95 },
  dark: { fill: "#00E7D0", fillOpacity: 0.16, stroke: "#5BFFE5", strokeOpacity: 0.9 },
};

export function RegionPolygon({ path }: { path: LatLngPath }) {
  const map = useSyncExternalStore(
    subscribeRegisteredMap,
    getRegisteredMap,
    () => null,
  );
  const theme = useSyncExternalStore(subscribeTheme, readDocumentTheme, () => "light" as const);

  useEffect(() => {
    if (!map) return;
    if (typeof window === "undefined") return;
    const naver = window.naver;
    if (!naver) return;

    const palette = POLYGON_PALETTE[theme];
    const polygon = new naver.maps.Polygon({
      map,
      paths: [path.map(({ lat, lng }) => new naver.maps.LatLng(lat, lng))],
      fillColor: palette.fill,
      fillOpacity: palette.fillOpacity,
      strokeColor: palette.stroke,
      strokeOpacity: palette.strokeOpacity,
      strokeWeight: 2,
      strokeStyle: "solid",
      clickable: false,
    });

    return () => {
      polygon.setMap(null);
    };
  }, [map, path, theme]);

  return null;
}
