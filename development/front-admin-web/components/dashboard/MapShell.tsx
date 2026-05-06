"use client";

import Script from "next/script";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { NaverMapInstance, NaverMapOptions } from "@/types/naver-maps";

const NCP_CLIENT_ID = process.env.NEXT_PUBLIC_NCP_MAP_CLIENT_ID;
const NCP_STYLE_ID_LIGHT = process.env.NEXT_PUBLIC_NCP_MAP_STYLE_ID_LIGHT;
const NCP_STYLE_ID_DARK = process.env.NEXT_PUBLIC_NCP_MAP_STYLE_ID_DARK;

const SEOUL_DEFAULT_CENTER = { lat: 37.5666103, lng: 126.9783882 };
const DEFAULT_ZOOM = 13;

const SDK_BASE = "https://oapi.map.naver.com/openapi/v3/maps-gl.js";

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

export interface MapShellProps {
  children?: ReactNode;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
}

export function MapShell({
  children,
  initialCenter = SEOUL_DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
}: MapShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);

  const theme = useSyncExternalStore(subscribeTheme, readDocumentTheme, () => "light");

  // Initialised lazily so SPA navigations that already loaded the SDK skip the wait.
  const [sdkReady, setSdkReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.naver?.maps?.Map),
  );

  useEffect(() => {
    if (!sdkReady) return;
    const container = containerRef.current;
    const naver = typeof window !== "undefined" ? window.naver : undefined;
    if (!container || !naver?.maps?.Map) return;

    const styleId = theme === "dark" ? NCP_STYLE_ID_DARK : NCP_STYLE_ID_LIGHT;
    const options: NaverMapOptions = {
      center: new naver.maps.LatLng(initialCenter.lat, initialCenter.lng),
      zoom: initialZoom,
      gl: true,
      ...(styleId ? { customStyleId: styleId } : {}),
    };

    const map = new naver.maps.Map(container, options);
    mapRef.current = map;

    return () => {
      try {
        mapRef.current?.destroy?.();
      } catch {
        // NCP SDK does not always expose destroy(); ignore on older releases.
      }
      mapRef.current = null;
    };
  }, [sdkReady, theme, initialCenter.lat, initialCenter.lng, initialZoom]);

  if (!NCP_CLIENT_ID) {
    return (
      <div className="map-shell map-shell-unconfigured" role="presentation" aria-hidden="true">
        <div className="map-shell-notice">
          <strong>NCP Maps 클라이언트 ID가 설정되지 않았습니다.</strong>
          <span>
            <code>NEXT_PUBLIC_NCP_MAP_CLIENT_ID</code> 환경 변수를 설정한 뒤 다시 빌드하세요.
          </span>
        </div>
        {children}
      </div>
    );
  }

  return (
    <>
      <Script
        src={`${SDK_BASE}?ncpClientId=${encodeURIComponent(NCP_CLIENT_ID)}`}
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
        onLoad={() => setSdkReady(true)}
      />
      <div ref={containerRef} className="map-shell" data-map-theme={theme} aria-hidden="true" />
      {children}
    </>
  );
}
