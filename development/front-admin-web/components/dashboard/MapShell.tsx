"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type {
  FrontendDashboardBikePin,
  FrontendDashboardStationPin
} from "@/lib/services/service-ops-api";
import type {
  NaverEventListener,
  NaverMapInstance,
  NaverMapOptions,
  NaverMarkerInstance
} from "@/types/naver-maps";
import type { DeliveryPhase } from "@/lib/services/fleet-simulation";

const NCP_CLIENT_ID = process.env.NEXT_PUBLIC_NCP_MAP_CLIENT_ID;
const NCP_STYLE_ID_LIGHT = process.env.NEXT_PUBLIC_NCP_MAP_STYLE_ID_LIGHT;
const NCP_STYLE_ID_DARK = process.env.NEXT_PUBLIC_NCP_MAP_STYLE_ID_DARK;

const SEOUL_DEFAULT_CENTER = { lat: 37.5666103, lng: 126.9783882 };
const DEFAULT_ZOOM = 13;

// Line-art SVG 아이콘 마커. 운영자가 "이건 차량 / 이건 BSS" 를 즉시 알아볼 수
// 있도록 dot 대신 인지 가능한 silhouette 로 교체.
// - 차량: 배달용 스쿠터 (앞·뒤 바퀴 + 핸들 + 후방 배달박스). 색은 `--rm-accent`.
// - BSS: 배터리 + 가운데 번개 마크. 색은 `--rm-battery-mid` (노랑 톤).
// stroke 기반(`currentColor`) 이라 light/dark 테마 색 변동도 그대로 따라간다.
// drop-shadow 1px 로 어떤 지도 배경 위에서도 외곽선이 살아 보이게 보강.
// 줌 ≥ LABEL_VISIBLE_ZOOM 이면 아이콘 위에 pill 형태 라벨(번호판 / 스테이션
// 이름)이 함께 노출되어 확대 시 식별 가능.
const ICON_PX = 28;
const ICON_ANCHOR = ICON_PX / 2;
const LABEL_VISIBLE_ZOOM = 12;

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
  bikePins?: Array<FrontendDashboardBikePin & { deliveryPhase?: DeliveryPhase | null }>;
  stationPins?: FrontendDashboardStationPin[];
  onBikeSelect?: (bikeId: string) => void;
  onStationSelect?: (stationId: string) => void;
  /**
   * 검색 결과 선택 시 해당 좌표로 지도를 팬/줌. 같은 좌표를 두 번 누르면
   * 객체 identity 가 매번 새로 생겨 effect 가 다시 발화하도록 부모에서
   * 새 객체로 넘긴다. null 이면 아무 동작 없음.
   */
  targetLocation?: { lat: number; lng: number; zoom?: number } | null;
  /**
   * 첫 마커 fit 시 적용할 padding (NCP `fitBounds` 옵션). 기본 사방 48px.
   * 전체화면 모드처럼 캔버스 위에 floating 헤더 / 필터 바가 떠 있는 화면은
   * 상단 padding 을 더 크게 줘서 마커가 그 floating 영역 뒤에 박히지 않게.
   */
  fitBoundsPadding?: { top: number; right: number; bottom: number; left: number };
}

const DEFAULT_FIT_BOUNDS_PADDING = { top: 48, right: 48, bottom: 48, left: 48 };

export function MapShell({
  children,
  initialCenter = SEOUL_DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
  bikePins = [],
  stationPins = [],
  onBikeSelect,
  onStationSelect,
  targetLocation = null,
  fitBoundsPadding = DEFAULT_FIT_BOUNDS_PADDING,
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

  // 현재 줌 추적. 라벨 표시 임계값(LABEL_VISIBLE_ZOOM) 위/아래 전환 시
  // 마커 effect 가 재실행되어 HTML 컨텐츠를 다시 그린다.
  const [currentZoom, setCurrentZoom] = useState(initialZoom);
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

  // Pan/zoom to a search target when the parent supplies one. Each click on
  // a search result hands us a freshly-constructed object so this effect
  // re-fires even when the operator picks the same pin twice in a row.
  useEffect(() => {
    if (!sdkReady || !targetLocation) return;
    const map = mapRef.current;
    const naver = typeof window !== "undefined" ? window.naver : undefined;
    if (!map?.setCenter || !naver?.maps?.LatLng) return;
    map.setCenter(new naver.maps.LatLng(targetLocation.lat, targetLocation.lng));
    if (targetLocation.zoom !== undefined && map.setZoom) {
      map.setZoom(targetLocation.zoom);
    }
  }, [sdkReady, targetLocation, mapVersion]);

  // 지도 첫 표시 시 모든 마커(차량 + BSS) 가 한 화면에 들어오도록 zoom-to-layer.
  // `hasFittedRef` 로 1회만 발화 — 폴링으로 핀이 추가/제거되어도 운영자의
  // 현재 시점을 잡아챘다가 다시 fit 하지 않는다. 테마 토글로 NCP map 이
  // 재생성되면(mapVersion 증가) 그땐 새 인스턴스에 다시 한 번 fit.
  //
  // `firstFitReady` 는 "fit 결정 완료" 신호 — 렌더러가 그 시점까지 캔버스
  // 위에 로딩 오버레이를 띄워서 운영자가 "서울 기본 중심 → 휙 이동" 의 잠깐
  // 잘못된 위치 단계를 안 보게 한다.
  const hasFittedRef = useRef(false);
  const [firstFitReady, setFirstFitReady] = useState(false);
  // 테마 토글로 새 NCP map 인스턴스가 만들어지면 그 인스턴스에 대해 다시
  // fit 을 돌려야 하니 ref 만 리셋한다. `firstFitReady` 자체는 리셋하지
  // 않는다 — 운영자가 이미 지도를 보고 있는 상태라 짧은 깜빡임이 로딩
  // 오버레이가 다시 깔리는 것보다 거슬리지 않고, 첫 mount 가 아닌 swap 의
  // 한 프레임 차이는 GL canvas 가 자연스럽게 메꿔준다.
  useEffect(() => {
    hasFittedRef.current = false;
  }, [mapVersion]);
  useEffect(() => {
    if (!sdkReady || hasFittedRef.current) return;
    const map = mapRef.current;
    const naver = typeof window !== "undefined" ? window.naver : undefined;
    if (!map?.fitBounds || !naver?.maps?.LatLng || !naver.maps.LatLngBounds) return;

    const all: { lat: number; lng: number }[] = [];
    for (const pin of bikePins) all.push({ lat: pin.latitude, lng: pin.longitude });
    for (const pin of stationPins) all.push({ lat: pin.latitude, lng: pin.longitude });

    // 오버레이를 걷어내는 시점은 항상 비동기로 미뤄서 GL canvas 가 최종 시점을
    // paint 한 다음에 노출되게 한다. 또한 effect body 안에서의 sync setState
    // (`react-hooks/set-state-in-effect`) 도 피한다. 정리 함수를 끼워서
    // unmount / 재실행 시에는 보류된 ready 신호가 새 인스턴스를 건드리지
    // 않도록 한다.
    let scheduledRaf: number | null = null;
    let pendingIdleListener: NaverEventListener | null = null;
    let fallbackTimer: number | null = null;
    let cancelled = false;

    const finalize = () => {
      if (cancelled) return;
      cancelled = true;
      if (pendingIdleListener && naver?.maps?.Event) {
        naver.maps.Event.removeListener(pendingIdleListener);
        pendingIdleListener = null;
      }
      if (fallbackTimer !== null && typeof window !== "undefined") {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      setFirstFitReady(true);
    };

    const markReadyNextFrame = () => {
      if (typeof window === "undefined") {
        finalize();
        return;
      }
      scheduledRaf = window.requestAnimationFrame(finalize);
    };

    // fitBounds 는 NCP 가 짧은 pan/zoom 애니메이션을 깔아주는 비동기 동작이라,
    // 호출 직후 한 프레임만 양보해서 오버레이를 걷으면 운영자에겐 마커가 절반
    // 정도 이동한 상태가 노출돼 "갑자기 위치가 바뀌는" 느낌이 남는다. 그래서
    // 첫 `idle` 이벤트 (pan/zoom 완료 + 타일 로드 완료) 를 기다린 뒤 오버레이
    // 를 제거한다. 1초 fallback 으로 idle 이 어떤 이유로 발화 안 될 때도 무한
    // 로딩에 빠지지 않게 보호.
    const waitForIdle = () => {
      if (!naver?.maps?.Event || typeof window === "undefined") {
        markReadyNextFrame();
        return;
      }
      pendingIdleListener = naver.maps.Event.addListener(map, "idle", finalize);
      fallbackTimer = window.setTimeout(finalize, 1000);
    };

    if (all.length === 0) {
      // 핀이 아예 없으면 fit 할 게 없으니 기본 중심 그대로 노출. 운영자가
      // 빈 상태도 봐야 데이터 없음을 인지할 수 있어서 무한 로딩으로 두지 않음.
      hasFittedRef.current = true;
      markReadyNextFrame();
    } else if (all.length === 1) {
      // 핀 한 개면 fitBounds 가 max-zoom 까지 끌어버려 너무 가까워진다 —
      // 그냥 중심만 옮기고 기본 줌을 유지. setCenter 는 즉시 반영되므로
      // idle 이벤트가 발화 안 할 수 있어 다음 프레임에 바로 표시.
      const only = all[0];
      map.setCenter?.(new naver.maps.LatLng(only.lat, only.lng));
      hasFittedRef.current = true;
      markReadyNextFrame();
    } else {
      const first = all[0];
      const bounds = new naver.maps.LatLngBounds(
        new naver.maps.LatLng(first.lat, first.lng),
        new naver.maps.LatLng(first.lat, first.lng)
      );
      for (let i = 1; i < all.length; i++) {
        bounds.extend(new naver.maps.LatLng(all[i].lat, all[i].lng));
      }
      // 가장자리 마커가 dot/label 까지 잘리지 않도록 패딩 적용. 기본은 사방
      // 48px; 전체화면 모드는 상단의 floating 필터 바를 피하려고 더 큰 top
      // padding 을 부모가 prop 으로 박아 넘긴다.
      map.fitBounds(bounds, fitBoundsPadding);
      hasFittedRef.current = true;
      waitForIdle();
    }

    return () => {
      // 첫 fit 이 이미 완료된 (hasFittedRef.current === true) 후에 bikePins
      // identity 가 바뀌어 effect 가 재발화하는 케이스 (예: fleet 시뮬레이션이
      // 매 tick 새 array 를 만드는 경우) 에서는 다음 effect 가 early return
      // 으로 새 fit / listener / timer 를 만들지 않는다. 그러면 이전에 등록된
      // rAF / idle listener / fallback timer 가 그대로 fire 해서 firstFitReady
      // 를 set 해 줘야 로딩 오버레이가 사라진다. 이 cleanup 이 그걸 cancel
      // 해 버리면 finalize 가 영영 호출되지 않아 로딩이 무한 노출된다.
      //
      // 정상 unmount / 첫 fit 진행 중 deps 가 바뀌는 케이스는 여전히 cleanup
      // 이 필요하므로 hasFittedRef 가 true 일 때만 보존 분기.
      if (hasFittedRef.current) return;
      cancelled = true;
      if (scheduledRaf !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(scheduledRaf);
        scheduledRaf = null;
      }
      if (pendingIdleListener && naver?.maps?.Event) {
        naver.maps.Event.removeListener(pendingIdleListener);
        pendingIdleListener = null;
      }
      if (fallbackTimer !== null && typeof window !== "undefined") {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };
  }, [sdkReady, bikePins, stationPins, mapVersion, fitBoundsPadding]);

  // Bike markers — DotMap 스타일 (10px translucent solid dot + white stroke).
  // 겹치는 점은 alpha 합성으로 색이 짙어져 밀도 시각화. 줌 무관 고정 크기.
  useEffect(() => {
    if (!sdkReady) return;
    const map = mapRef.current;
    const naver = typeof window !== "undefined" ? window.naver : undefined;
    if (!map || !naver?.maps?.Marker) return;

    const cache = bikeMarkerCacheRef.current;
    const incomingIds = new Set<string>();

    const showLabel = currentZoom >= LABEL_VISIBLE_ZOOM;
    for (const pin of bikePins) {
      incomingIds.add(pin.bikeId);
      const position = new naver.maps.LatLng(pin.latitude, pin.longitude);
      const html = bikeMarkerHtml(pin.pinLabel ?? pin.plateNumber, showLabel, pin.deliveryPhase);
      const icon = {
        content: html,
        anchor: new naver.maps.Point(ICON_ANCHOR, ICON_ANCHOR),
        size: new naver.maps.Size(ICON_PX, ICON_PX)
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

  // Station markers — 차량과 동일한 DotMap 스타일, 색만 `--rm-battery-high`
  // (녹색) 으로 구분.
  useEffect(() => {
    if (!sdkReady) return;
    const map = mapRef.current;
    const naver = typeof window !== "undefined" ? window.naver : undefined;
    if (!map || !naver?.maps?.Marker) return;

    const cache = stationMarkerCacheRef.current;
    const incomingIds = new Set<string>();

    const showLabel = currentZoom >= LABEL_VISIBLE_ZOOM;
    for (const pin of stationPins) {
      incomingIds.add(pin.stationId);
      const position = new naver.maps.LatLng(pin.latitude, pin.longitude);
      const html = stationMarkerHtml(pin.name, showLabel);
      const icon = {
        content: html,
        anchor: new naver.maps.Point(ICON_ANCHOR, ICON_ANCHOR),
        size: new naver.maps.Size(ICON_PX, ICON_PX)
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
        {/* fit-to-layer 가 끝날 때까지 캔버스를 가리는 로딩 오버레이. NCP 가
            map 인스턴스를 막 만든 직후의 "서울 기본 중심" 첫 프레임이 운영자
            눈에 들어가지 않도록 함. */}
        {!firstFitReady ? (
          <div className="map-shell-loading" role="status" aria-live="polite">
            <span className="map-shell-spinner" aria-hidden="true" />
            <span>지도 불러오는 중…</span>
          </div>
        ) : null}
      </div>
      {children}
    </>
  );
}

/**
 * 마커 위에 띄우는 pill 형태 라벨. CSS 는 globals.css 의 `.map-marker-label`
 * 토큰에 정의되어 있어 light/dark + 타이포그래피가 거기서 통일된다. 마커의
 * `pointer-events: auto` 와 충돌하지 않게 라벨 자체는 `pointer-events: none`.
 */
function labelMarkup(text: string): string {
  // 텍스트는 안전하게 inner text 만 노출 — operator-입력 plate / station name
  // 이 HTML 을 포함할 가능성은 거의 없지만 escape 처리해서 안전망.
  const safe = text.replace(/[&<>"]/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;"
  );
  return `<span class="map-marker-label">${safe}</span>`;
}

/**
 * 배송 상태 배지 HTML. IDLE 이면 빈 문자열.
 * 마커 컨테이너(relative 28×28) 아래에 absolute 로 위치 — 아이콘 밑에 노출.
 */
function deliveryBadgeMarkup(phase: DeliveryPhase): string {
  if (phase === "IDLE") return "";
  const config: Record<Exclude<DeliveryPhase, "IDLE">, { text: string; bg: string }> = {
    ASSIGNED: { text: "배정됨", bg: "#f59e0b" },
    EN_ROUTE: { text: "배송 중", bg: "#3b82f6" },
    ARRIVED: { text: "배송 완료", bg: "#22c55e" }
  };
  const { text, bg } = config[phase];
  return (
    `<div style="position:absolute;top:100%;left:50%;transform:translateX(-50%);` +
    `margin-top:2px;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;` +
    `color:#fff;white-space:nowrap;background:${bg};pointer-events:none;">` +
    `${text}</div>`
  );
}

// 공통 SVG attribute. stroke 기반 line-art 가 currentColor 를 따라간다.
const ICON_SVG_PROPS = `width="${ICON_PX}" height="${ICON_PX}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;

/** 배달 스쿠터 silhouette — 앞·뒤 바퀴 + 핸들 + 좌석 + 후방 배달박스. */
function bikeIconSvg(): string {
  return `<svg ${ICON_SVG_PROPS}>
    <circle cx="6" cy="18" r="2"/>
    <circle cx="18" cy="18" r="2"/>
    <path d="M6 16 L7 10"/>
    <path d="M7 10 L10 8"/>
    <path d="M7 10 H13 L16 14"/>
    <path d="M8 16 H16"/>
    <rect x="13" y="4" width="7" height="6" rx="0.75"/>
    <path d="M13 6.5 H20"/>
  </svg>`;
}

/** 충전 배터리 silhouette — 위쪽 단자 + 본체 + 가운데 번개 마크. */
function stationIconSvg(): string {
  return `<svg ${ICON_SVG_PROPS}>
    <path d="M10 4 H14"/>
    <rect x="6" y="6" width="12" height="15" rx="1.5"/>
    <path d="M12.5 9 L9.5 14 H12 L10.8 18 L14 12.5 H11.5 Z"/>
  </svg>`;
}

/**
 * 마커 래퍼. `color: var(...)` 가 SVG `stroke="currentColor"` 로 전파되어
 * 색을 가르고, drop-shadow 로 지도 배경 위 가시성을 확보한다. `line-height: 0`
 * 은 SVG 가 inline-element 라 기본적으로 baseline 여백을 만드는 걸 잘라 — 그
 * 여백이 anchor 계산과 어긋나면 마커가 lat/lng 점 위에서 미세하게 떠 보임.
 */
function markerWrapper(iconSvg: string, colorVar: string): string {
  return `<div style="pointer-events:auto;color:var(${colorVar});width:${ICON_PX}px;height:${ICON_PX}px;line-height:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">${iconSvg}</div>`;
}

/** BSS 마커 — 충전 배터리 아이콘 + (옵션) 스테이션 이름 라벨. */
function stationMarkerHtml(name: string, showLabel: boolean): string {
  const wrapped = markerWrapper(stationIconSvg(), "--rm-battery-mid");
  if (!showLabel) return wrapped;
  return `<div style="position:relative;pointer-events:auto;width:${ICON_PX}px;height:${ICON_PX}px;">${labelMarkup(name)}${wrapped}</div>`;
}

/** 차량 마커 — 배달 스쿠터 아이콘 + (옵션) 번호판 라벨 + (옵션) 배송 상태 배지. */
function bikeMarkerHtml(
  plateNumber: string,
  showLabel: boolean,
  deliveryPhase?: DeliveryPhase | null
): string {
  const wrapped = markerWrapper(bikeIconSvg(), "--rm-accent");
  const badge = deliveryPhase ? deliveryBadgeMarkup(deliveryPhase) : "";
  if (!showLabel && !badge) return wrapped;
  return (
    `<div style="position:relative;pointer-events:auto;width:${ICON_PX}px;height:${ICON_PX}px;">` +
    `${showLabel ? labelMarkup(plateNumber) : ""}${wrapped}${badge}` +
    `</div>`
  );
}
