"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type {
  FrontendDashboardBikePin,
  FrontendDashboardStationPin
} from "@/lib/services/service-ops-api";
import type {
  NaverMapInstance,
  NaverMapOptions,
  NaverMarkerInstance
} from "@/types/naver-maps";

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

type CachedMap = { map: NaverMapInstance; styleId: string | undefined };

// Module-level cache so a single container reuses the same NCP map across
// React Strict-mode double mounts and HMR-triggered re-renders. NCP bills a
// new map "session" each time `new naver.maps.Map(...)` is called, so
// recreating on every effect run inflates the API meter. The WeakMap is
// keyed by the live DOM element, which means a real SPA navigation that
// builds a new container still creates one fresh map (the previous entry is
// garbage-collected once the old div is removed).
const mapInstanceByContainer = new WeakMap<HTMLDivElement, CachedMap>();

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
  bikePins?: FrontendDashboardBikePin[];
  stationPins?: FrontendDashboardStationPin[];
  onBikeSelect?: (bikeId: string) => void;
  onStationSelect?: (stationId: string) => void;
}

export function MapShell({
  children,
  initialCenter = SEOUL_DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
  bikePins = [],
  stationPins = [],
  onBikeSelect,
  onStationSelect,
}: MapShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const bikeMarkerCacheRef = useRef<Map<string, NaverMarkerInstance>>(new Map());
  const stationMarkerCacheRef = useRef<Map<string, NaverMarkerInstance>>(new Map());
  const onBikeSelectRef = useRef(onBikeSelect);
  const onStationSelectRef = useRef(onStationSelect);

  // Bumped each time the underlying NCP map is recreated (e.g. on theme
  // toggle, since `customStyleId` cannot be swapped on a live map). The
  // marker effects depend on this counter so they rebuild their handles
  // against the new map even though the pin lists themselves did not change.
  const [mapVersion, setMapVersion] = useState(0);

  useEffect(() => {
    onBikeSelectRef.current = onBikeSelect;
    onStationSelectRef.current = onStationSelect;
  }, [onBikeSelect, onStationSelect]);

  const theme = useSyncExternalStore(subscribeTheme, readDocumentTheme, () => "light");
  const styleId = theme === "dark" ? NCP_STYLE_ID_DARK : NCP_STYLE_ID_LIGHT;

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

    // NCP TOS requires the NAVER logo to stay visible. Repositioning the
    // built-in `logoControl` to TOP_RIGHT keeps us compliant while clearing
    // the bottom-left where future detail panels and FABs will live. The
    // default SDK anchor is BOTTOM_LEFT, so we set it explicitly here.
    const logoPosition = naver.maps.Position?.TOP_RIGHT;

    // Same container + same styleId — Strict-mode double mount or HMR
    // re-run. Reuse without burning a new NCP map session.
    const existing = mapInstanceByContainer.get(container);
    if (existing && existing.styleId === styleId) {
      mapRef.current = existing.map;
      return;
    }

    // Theme toggle path: the JSX below keys the canvas <div> on `styleId`,
    // so React already unmounted the old container and mounted a fresh one.
    // The cache lookup above misses against the new container, so we fall
    // through to building a new map.
    if (existing) {
      bikeMarkerCacheRef.current.clear();
      stationMarkerCacheRef.current.clear();
    }

    const options: NaverMapOptions = {
      center: new naver.maps.LatLng(initialCenter.lat, initialCenter.lng),
      zoom: initialZoom,
      gl: true,
      ...(styleId ? { customStyleId: styleId } : {}),
      logoControl: true,
      ...(logoPosition !== undefined
        ? { logoControlOptions: { position: logoPosition } }
        : {}),
    };

    const map = new naver.maps.Map(container, options);
    mapInstanceByContainer.set(container, { map, styleId });
    mapRef.current = map;
    setMapVersion((version) => version + 1);

    return () => {
      mapRef.current = null;
    };
  }, [sdkReady, styleId, initialCenter.lat, initialCenter.lng, initialZoom]);

  // Bike markers — diff against the cache so the same bikeId reuses its
  // NaverMarker instance. This is the cheap path for polling: setPosition
  // costs nothing compared to `new naver.maps.Marker(...)` which allocates a
  // DOM node + event listeners every time.
  useEffect(() => {
    if (!sdkReady) return;
    const map = mapRef.current;
    const naver = typeof window !== "undefined" ? window.naver : undefined;
    if (!map || !naver?.maps?.Marker) return;

    const cache = bikeMarkerCacheRef.current;
    const incomingIds = new Set<string>();

    for (const pin of bikePins) {
      incomingIds.add(pin.bikeId);
      const position = new naver.maps.LatLng(pin.latitude, pin.longitude);
      const existing = cache.get(pin.bikeId);
      if (existing) {
        existing.setPosition?.(position);
        continue;
      }
      const marker = new naver.maps.Marker({
        position,
        map,
        title: pin.pinLabel ?? pin.plateNumber,
        clickable: Boolean(onBikeSelectRef.current)
      });
      if (onBikeSelectRef.current && naver.maps.Event) {
        naver.maps.Event.addListener(marker, "click", () => {
          onBikeSelectRef.current?.(pin.bikeId);
        });
      }
      cache.set(pin.bikeId, marker);
    }

    for (const [bikeId, marker] of cache.entries()) {
      if (!incomingIds.has(bikeId)) {
        marker.setMap(null);
        cache.delete(bikeId);
      }
    }
  }, [sdkReady, bikePins, mapVersion]);

  // Station markers — same diff strategy. Stations don't move, so the cache
  // mostly catches set-once + occasional add/remove during ops.
  useEffect(() => {
    if (!sdkReady) return;
    const map = mapRef.current;
    const naver = typeof window !== "undefined" ? window.naver : undefined;
    if (!map || !naver?.maps?.Marker) return;

    const cache = stationMarkerCacheRef.current;
    const incomingIds = new Set<string>();

    for (const pin of stationPins) {
      incomingIds.add(pin.stationId);
      const position = new naver.maps.LatLng(pin.latitude, pin.longitude);
      const existing = cache.get(pin.stationId);
      if (existing) {
        existing.setPosition?.(position);
        continue;
      }
      const marker = new naver.maps.Marker({
        position,
        map,
        title: pin.pinLabel ?? pin.name,
        clickable: Boolean(onStationSelectRef.current)
      });
      if (onStationSelectRef.current && naver.maps.Event) {
        naver.maps.Event.addListener(marker, "click", () => {
          onStationSelectRef.current?.(pin.stationId);
        });
      }
      cache.set(pin.stationId, marker);
    }

    for (const [stationId, marker] of cache.entries()) {
      if (!incomingIds.has(stationId)) {
        marker.setMap(null);
        cache.delete(stationId);
      }
    }
  }, [sdkReady, stationPins, mapVersion]);

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
        <div
          key={`map-canvas-${styleId ?? "default"}`}
          ref={containerRef}
          className="map-shell-canvas"
        />
      </div>
      {children}
    </>
  );
}
