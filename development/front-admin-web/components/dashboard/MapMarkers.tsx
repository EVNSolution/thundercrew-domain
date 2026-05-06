"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  getRegisteredMap,
  subscribeRegisteredMap,
} from "@/lib/dashboard/map-registry";
import type { NaverMarkerInstance } from "@/types/naver-maps";

interface MapMarkerCommonProps {
  lat: number;
  lng: number;
  label?: string;
  title?: string;
  onSelect?: () => void;
}

const RIDER_ANCHOR = { x: 14, y: 14 } as const;
const STATION_ANCHOR = { x: 14, y: 28 } as const;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function useNcpMarker({
  lat,
  lng,
  content,
  anchor,
  title,
  onSelect,
}: {
  lat: number;
  lng: number;
  content: string;
  anchor: { readonly x: number; readonly y: number };
  title?: string;
  onSelect?: () => void;
}) {
  const map = useSyncExternalStore(
    subscribeRegisteredMap,
    getRegisteredMap,
    () => null,
  );
  const markerRef = useRef<NaverMarkerInstance | null>(null);
  const onSelectRef = useRef(onSelect);

  // Track the latest click handler so the marker creation effect can stay
  // tied only to position/content changes.
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    if (!map) return;
    if (typeof window === "undefined") return;
    const naver = window.naver;
    if (!naver) return;

    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(lat, lng),
      map,
      title,
      icon: {
        content,
        anchor: new naver.maps.Point(anchor.x, anchor.y),
      },
    });
    markerRef.current = marker;

    const listener = naver.maps.Event.addListener(marker, "click", () => {
      onSelectRef.current?.();
    });

    return () => {
      naver.maps.Event.removeListener(listener);
      marker.setMap(null);
      markerRef.current = null;
    };
  }, [map, lat, lng, content, title, anchor.x, anchor.y]);
}

export function RiderMarker({ lat, lng, label, title, onSelect }: MapMarkerCommonProps) {
  const content = useMemo(
    () => `
      <div class="rm-rider-ping">
        <span class="rm-rider-ping-halo" aria-hidden="true"></span>
        <span class="rm-rider-ping-dot" aria-hidden="true"></span>
        ${label ? `<span class="rm-rider-ping-tag">${escapeHtml(label)}</span>` : ""}
      </div>
    `,
    [label],
  );

  useNcpMarker({ lat, lng, content, anchor: RIDER_ANCHOR, title: title ?? label, onSelect });

  return null;
}

export function StationMarker({ lat, lng, label, title, onSelect }: MapMarkerCommonProps) {
  const content = useMemo(
    () => `
      <div class="rm-station-pin">
        <span class="rm-station-pin-icon" aria-hidden="true">B</span>
        ${label ? `<span class="rm-station-pin-tag">${escapeHtml(label)}</span>` : ""}
      </div>
    `,
    [label],
  );

  useNcpMarker({ lat, lng, content, anchor: STATION_ANCHOR, title: title ?? label, onSelect });

  return null;
}
