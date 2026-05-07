"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { NaverMapInstance, NaverMapOptions } from "@/types/naver-maps";

const NCP_CLIENT_ID = process.env.NEXT_PUBLIC_NCP_MAP_CLIENT_ID;
const NCP_STYLE_ID_LIGHT = process.env.NEXT_PUBLIC_NCP_MAP_STYLE_ID_LIGHT;
const NCP_STYLE_ID_DARK = process.env.NEXT_PUBLIC_NCP_MAP_STYLE_ID_DARK;

const SEOUL_DEFAULT_CENTER = { lat: 37.5666103, lng: 126.9783882 };
const DEFAULT_ZOOM = 13;

// Two-step load: base SDK first, then the GL companion. The official
// `submodules=gl` shortcut races with the auto-injected GL bundle whenever
// React mounts MapShell while other dev-mode scripts are still parsing,
// leaving `window.naver.maps` set to null. Loading the two scripts in order
// from our own effect avoids that race.
const SDK_BASE_URL = "https://oapi.map.naver.com/openapi/v3/maps.js";
const SDK_GL_URL = "https://oapi.map.naver.com/openapi/v3/maps-gl.js";

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

  // Inject the NCP SDK ourselves so we control the load order. The base
  // `maps.js` populates `window.naver.maps`; the GL companion is appended
  // only after the base finishes loading. The two scripts are tagged with
  // `data-id` so a remount or SPA navigation reuses them instead of
  // re-injecting.
  useEffect(() => {
    if (!NCP_CLIENT_ID || typeof document === "undefined") return;

    const markReady = () => setSdkReady(true);

    if (window.naver?.maps?.Map) {
      const handle = window.requestAnimationFrame(markReady);
      return () => window.cancelAnimationFrame(handle);
    }

    let cleanup: (() => void) | null = null;

    const loadGl = () => {
      const existingGl = document.querySelector<HTMLScriptElement>(
        'script[data-id="ncp-maps-sdk-gl"]',
      );
      if (existingGl) {
        existingGl.addEventListener("load", markReady, { once: true });
        cleanup = () => existingGl.removeEventListener("load", markReady);
        if (window.naver?.maps?.Map) markReady();
        return;
      }
      const gl = document.createElement("script");
      gl.src = SDK_GL_URL;
      gl.async = false;
      gl.dataset.id = "ncp-maps-sdk-gl";
      gl.addEventListener("load", markReady, { once: true });
      document.head.appendChild(gl);
      cleanup = () => gl.removeEventListener("load", markReady);
    };

    const existingBase = document.querySelector<HTMLScriptElement>(
      'script[data-id="ncp-maps-sdk-base"]',
    );

    if (existingBase) {
      if (window.naver?.maps?.Map) {
        loadGl();
      } else {
        existingBase.addEventListener("load", loadGl, { once: true });
        cleanup = () => existingBase.removeEventListener("load", loadGl);
      }
      return () => cleanup?.();
    }

    const base = document.createElement("script");
    // Newer NCP Maps service (Application Services > Maps) authenticates the
    // SDK via `ncpKeyId`. The legacy `ncpClientId` parameter loads the file
    // but the runtime auth check fails with "API KEY ID 정보가 없으므로
    // gl 서브 모듈을 사용할 수 없습니다" so the GL companion never wires up.
    base.src = `${SDK_BASE_URL}?ncpKeyId=${encodeURIComponent(NCP_CLIENT_ID)}`;
    base.async = false;
    base.dataset.id = "ncp-maps-sdk-base";
    base.addEventListener("load", loadGl, { once: true });
    document.head.appendChild(base);
    cleanup = () => base.removeEventListener("load", loadGl);

    return () => cleanup?.();
  }, []);

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
      // Skip mapRef.current?.destroy?.() — calling NCP map destroy in dev
      // mode (React Strict Mode double-mount) appears to nullify
      // `window.naver.maps`, breaking subsequent re-mounts. We let the next
      // map instance replace the ref instead and rely on browser GC for
      // cleanup. The container div is wiped on remount via React anyway.
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

  // The outer wrapper holds the dashboard layout (absolute, inset: 0). NCP
  // mutates the inline style of whichever element we hand to `new
  // naver.maps.Map(...)` — it forces `position: relative; overflow: hidden;
  // background: ...;` and that wins over our CSS file. Putting NCP on the
  // inner element keeps the layout token intact.
  return (
    <>
      <div className="map-shell" data-map-theme={theme} aria-hidden="true">
        <div ref={containerRef} className="map-shell-canvas" />
      </div>
      {children}
    </>
  );
}
