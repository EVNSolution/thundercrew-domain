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

// 마커 반경 5m를 현재 줌 레벨에서 픽셀로 변환.
const MARKER_RADIUS_METERS = 5;
const MIN_MARKER_PX = 4;
const LABEL_VISIBLE_ZOOM = 12;

function metersToPixels(meters: number, zoom: number, lat: number = 37.56): number {
  const metersPerPx = (156543.03 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const px = meters / metersPerPx;
  return Math.max(MIN_MARKER_PX, Math.round(px * 2)); // diameter
}

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
    // Destroy old markers so they don't linger on the dead map instance.
    if (existing) {
      for (const m of bikeMarkerCacheRef.current.values()) m.setMap(null);
      for (const m of stationMarkerCacheRef.current.values()) m.setMap(null);
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

  // Track current zoom for marker sizing
  const [currentZoom, setCurrentZoom] = useState(initialZoom);

  // Listen to zoom changes to resize markers proportionally
  useEffect(() => {
    if (!sdkReady) return;
    const map = mapRef.current;
    const naver = typeof window !== "undefined" ? window.naver : undefined;
    if (!map || !naver?.maps?.Event) return;

    const listener = naver.maps.Event.addListener(map, "zoom_changed", (zoom: unknown) => {
      setCurrentZoom(typeof zoom === "number" ? zoom : Number(zoom));
    });
    return () => {
      if (listener) naver.maps.Event.removeListener(listener);
    };
  }, [sdkReady, mapVersion]);

  // Bike markers — halo ring + center dot, sized to 100m radius.
  useEffect(() => {
    if (!sdkReady) return;
    const map = mapRef.current;
    const naver = typeof window !== "undefined" ? window.naver : undefined;
    if (!map || !naver?.maps?.Marker) return;

    const size = metersToPixels(MARKER_RADIUS_METERS, currentZoom);
    const half = Math.round(size / 2);
    const cache = bikeMarkerCacheRef.current;
    const incomingIds = new Set<string>();

    for (const pin of bikePins) {
      incomingIds.add(pin.bikeId);
      const position = new naver.maps.LatLng(pin.latitude, pin.longitude);
      const html = bikeMarkerHtml(size, pin.pinLabel ?? pin.plateNumber, currentZoom >= LABEL_VISIBLE_ZOOM);
      const icon = {
        content: html,
        anchor: new naver.maps.Point(half, half),
        size: new naver.maps.Size(size, size)
      };
      const existing = cache.get(pin.bikeId);
      if (existing) {
        existing.setPosition?.(position);
        existing.setIcon?.(icon);
        continue;
      }
      const marker = new naver.maps.Marker({
        position,
        map,
        title: pin.pinLabel ?? pin.plateNumber,
        icon,
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
  }, [sdkReady, bikePins, mapVersion, currentZoom]);

  // Station markers — dot + label card, dot sized to 100m radius.
  useEffect(() => {
    if (!sdkReady) return;
    const map = mapRef.current;
    const naver = typeof window !== "undefined" ? window.naver : undefined;
    if (!map || !naver?.maps?.Marker) return;

    const dotSize = metersToPixels(MARKER_RADIUS_METERS, currentZoom);
    const cache = stationMarkerCacheRef.current;
    const incomingIds = new Set<string>();

    for (const pin of stationPins) {
      incomingIds.add(pin.stationId);
      const position = new naver.maps.LatLng(pin.latitude, pin.longitude);
      const html = stationMarkerHtml(pin, dotSize, currentZoom >= LABEL_VISIBLE_ZOOM);
      const icon = {
        content: html,
        anchor: new naver.maps.Point(Math.round(dotSize / 2), Math.round(dotSize / 2)),
        size: new naver.maps.Size(dotSize, dotSize)
      };
      const existing = cache.get(pin.stationId);
      if (existing) {
        existing.setPosition?.(position);
        existing.setIcon?.(icon);
        continue;
      }
      const marker = new naver.maps.Marker({
        position,
        map,
        title: pin.pinLabel ?? pin.name,
        icon,
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
  }, [sdkReady, stationPins, mapVersion, currentZoom]);

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

/**
 * BSS 마커 — designs/rider-position-monitor.pen Component/Dark/BatteryStation.
 * 녹색 dot(pointCore) + 반투명 blur 라벨 카드(충전소명 + "n/m 보유").
 * CSS 변수를 참조해 light/dark 자동 전환.
 */
function stationMarkerHtml(pin: FrontendDashboardStationPin, dotSize: number, showLabel: boolean): string {
  const dot = `<div style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:var(--rm-battery-high);"></div>`;
  if (!showLabel) return `<div style="pointer-events:auto;">${dot}</div>`;
  return [
    `<div style="position:relative;pointer-events:auto;">`,
    dot,
    `<div style="position:absolute;bottom:100%;left:100%;margin-left:-2px;margin-bottom:-2px;padding:2px 5px;border-radius:4px;background:var(--color-text-primary);border:1px solid var(--rm-line-subtle);white-space:nowrap;line-height:1;">`,
    `<span style="font-size:10px;font-weight:700;color:var(--color-bg);font-family:var(--font-sans);display:block;">${pin.name}</span>`,
    `</div></div>`
  ].join("");
}

/**
 * 차량 마커 — solid dot + 아주 옅은 soft halo + 오른쪽 위 말풍선(번호판).
 * NCP DotMap 시각화처럼 "점" 느낌이 우선이고, halo 는 클러스터 감만 살려
 * 주는 보조 장식이라 border 없이 옅은 반투명 fill 만 둔다. 줌에 따라
 * dot 크기가 비례 변환. CSS 변수로 light/dark 자동 전환.
 */
function bikeMarkerHtml(size: number, plateNumber: string, showLabel: boolean): string {
  const coreSize = Math.max(4, Math.round(size * 0.35));
  const dotHtml = [
    `<div style="width:${size}px;height:${size}px;position:relative;">`,
    // halo: border 제거, halo-strong 대신 더 옅은 halo 토큰 사용. 가장자리
    // 가 흐릿한 "soft glow" 느낌으로 dot 본체를 두드러지게 해 준다.
    `<div style="position:absolute;inset:0;border-radius:50%;background:var(--rm-accent-halo);"></div>`,
    `<div style="position:absolute;top:50%;left:50%;width:${coreSize}px;height:${coreSize}px;transform:translate(-50%,-50%);border-radius:50%;background:var(--rm-accent);"></div>`,
    `</div>`
  ].join("");
  if (!showLabel) return `<div style="pointer-events:auto;">${dotHtml}</div>`;
  return [
    `<div style="position:relative;pointer-events:auto;">`,
    dotHtml,
    `<div style="position:absolute;bottom:100%;left:100%;margin-left:-2px;margin-bottom:-2px;padding:2px 5px;border-radius:4px;background:var(--color-text-primary);border:1px solid var(--rm-line-subtle);white-space:nowrap;line-height:1;">`,
    `<span style="font-size:9px;font-weight:700;color:var(--color-bg);font-family:var(--font-sans);display:block;">${plateNumber}</span>`,
    `</div></div>`
  ].join("");
}
