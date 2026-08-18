"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
  Marker as MapLibreMarker
} from "maplibre-gl";
import type {
  FrontendDashboardBikePin,
  FrontendDashboardStationPin,
  FrontendTipPin
} from "@/lib/services/service-ops-api";
import { isCleaningServiceType } from "@/lib/services/fleet-simulation";
import type { ServicePhase, ServiceType } from "@/lib/services/fleet-simulation";

/**
 * 운영 콘솔 지도. **MapLibre GL + OpenFreeMap(OSM 벡터 타일)** 을 쓴다.
 *
 * 전에는 NAVER NCP Maps 였다. 옮긴 이유는 키가 아니라 **실패 방식**이다. NCP 는
 * 호출 오리진이 콘솔에 등록돼 있지 않으면 인증을 거부하면서 `window.naver.maps`
 * 를 스스로 null 로 바꾸는데, 그 뒤 화면을 떠나면 SDK 자체 정리 코드가 그 null 을
 * 파고들어 **렌더러가 통째로 죽었다**. 운영자에겐 이동하려던 화면 대신 빈 오류
 * 페이지가 떴고, 오류가 교차 출처라 앱 코드로는 막을 수도 없었다. 프리뷰를 새
 * 포트/IP 로 띄울 때마다 콘솔에 URL 을 등록해야 하는 것도 같은 뿌리다.
 *
 * MapLibre + OpenFreeMap 은 키도 오리진 allowlist 도 없다. 그리고 마커가 DOM
 * 요소라서 **배경 타일이 실패해도 차량 위치는 계속 그려진다** — 최악의 경우가
 * "배경 없는 지도" 지 "죽은 화면" 이 아니다. 새 관리자 웹(SPA)/DSV 가 이미 같은
 * 조합을 쓴다.
 *
 * 타일 소스는 env 로 갈아끼울 수 있게 뒀다. OpenFreeMap 은 무료지만 SLA 가 없어서,
 * 운영 의존도가 커지면 자체 호스팅이나 유료 제공자로 옮기게 된다. 그때 바꿀 곳은
 * 아래 두 상수뿐이다.
 */
const MAP_STYLE_LIGHT =
  process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ?? "https://tiles.openfreemap.org/styles/bright";
const MAP_STYLE_DARK =
  process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? "https://tiles.openfreemap.org/styles/dark";

const SEOUL_DEFAULT_CENTER = { lat: 37.5666103, lng: 126.9783882 };
const DEFAULT_ZOOM = 13;

/**
 * NCP·구글 계열은 세계를 256px 타일로 세고 MapLibre 는 512px 로 센다. 그래서 같은
 * 배율을 보려면 MapLibre 쪽 zoom 이 정확히 1 낮아야 한다. 호출부(대시보드·검색·
 * 라벨 임계값)는 전부 NCP 시절 숫자로 쓰여 있으므로 **경계에서만** 변환하고 컴포넌트
 * 바깥으로는 계속 NCP 스케일을 노출한다. 이 변환을 빼면 지도가 늘 2배 확대돼 뜬다.
 */
const ZOOM_SCALE_OFFSET = -1;
const toMapZoom = (ncpZoom: number): number => ncpZoom + ZOOM_SCALE_OFFSET;
const fromMapZoom = (mapZoom: number): number => mapZoom - ZOOM_SCALE_OFFSET;

/**
 * 워커 스크립트 경로. **번들러를 태우지 않고 `public/` 에서 그대로 서빙한다.**
 *
 * `maplibre-gl-worker.mjs` 는 `from "./maplibre-gl-shared.mjs"` 라는 해시 없는 상대
 * import 를 갖고 있다. 번들러(Turbopack)가 두 파일에 해시를 붙여 내보내면 그 상대
 * 경로가 404 가 되고, 워커가 죽어 **타일이 하나도 안 온다** — 지도는 회색으로 남고
 * 콘솔엔 "Failed to load module script" 한 줄만 남는다. 실제로 그렇게 났다.
 *
 * `scripts/copy-maplibre-worker.mjs` 가 빌드마다 node_modules 에서 두 파일을 원본
 * 이름으로 복사해 둔다. 이 경로를 바꾸려면 그 스크립트도 같이 바꿔야 한다.
 */
const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

/** 배경 타일이 이 시간 안에 안 뜨면 "배경 없음" 으로 판정한다. */
const BASEMAP_TIMEOUT_MS = 10_000;

const TRAIL_SOURCE_ID = "thundercrew-trail";
const TRAIL_LAYER_ID = "thundercrew-trail-line";

// Line-art SVG 아이콘 마커. 운영자가 "이건 차량 / 이건 BSS" 를 즉시 알아볼 수
// 있도록 dot 대신 인지 가능한 silhouette 로 교체.
// - 차량: 배달용 스쿠터 (앞·뒤 바퀴 + 핸들 + 후방 배달박스). 색은 `--rm-accent`.
// - BSS: 배터리 + 가운데 번개 마크. 색은 `--rm-battery-mid` (노랑 톤).
// stroke 기반(`currentColor`) 이라 light/dark 테마 색 변동도 그대로 따라간다.
// drop-shadow 1px 로 어떤 지도 배경 위에서도 외곽선이 살아 보이게 보강.
// 줌 ≥ LABEL_VISIBLE_ZOOM 이면 아이콘 위에 pill 형태 라벨(번호판 / 스테이션
// 이름)이 함께 노출되어 확대 시 식별 가능.
const ICON_PX = 28;
const LABEL_VISIBLE_ZOOM = 12;
/** 배지가 아이콘 아래에 위치할 때 top 오프셋 (= 아이콘 높이 + 2px 여백). */
const BADGE_TOP_OFFSET = ICON_PX + 2;

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

/**
 * 한 레이어(차량/BSS/팁/배송지)의 마커 한 개.
 *
 * `html` 을 들고 있는 이유: 내용이 진짜 바뀐 tick 에만 innerHTML 을 건드리기
 * 위해서다. NCP 시절엔 `setIcon` 이 content 를 갱신하지 않아서 배지·강조가 바뀔
 * 때마다 마커를 **재생성**해야 했고, 그걸 위해 phase/selected/completed 를 따로
 * 기억하는 ref 가 세 개 있었다. DOM 마커는 그냥 innerHTML 을 바꾸면 되므로 그
 * 우회 장치가 전부 없어졌다.
 *
 * `onClick` 을 entry 에 두는 이유: 리스너는 마커를 만들 때 한 번만 붙이고, 최신
 * 콜백은 entry 를 통해 읽는다. 안 그러면 재렌더마다 리스너를 다시 붙이게 된다.
 */
type MarkerEntry = {
  marker: MapLibreMarker;
  element: HTMLDivElement;
  html: string;
  onClick?: () => void;
};

type MarkerSpec = {
  id: string;
  lat: number;
  lng: number;
  html: string;
  title: string;
  onClick?: () => void;
};

/**
 * 마커 레이어 한 개를 spec 목록에 맞춘다 — 있으면 갱신, 없으면 생성, 빠졌으면 제거.
 * 네 레이어가 전부 같은 lifecycle 이라 한 곳으로 모았다.
 */
function syncMarkerLayer(
  map: MapLibreMap,
  MarkerCtor: typeof MapLibreMarker,
  cache: Map<string, MarkerEntry>,
  specs: ReadonlyArray<MarkerSpec>
): void {
  const incoming = new Set<string>();

  for (const spec of specs) {
    incoming.add(spec.id);
    const existing = cache.get(spec.id);
    if (existing) {
      existing.marker.setLngLat([spec.lng, spec.lat]);
      if (existing.html !== spec.html) {
        existing.element.innerHTML = spec.html;
        existing.html = spec.html;
      }
      existing.element.title = spec.title;
      existing.onClick = spec.onClick;
      continue;
    }

    const element = document.createElement("div");
    // 마커 HTML 은 스스로 28×28 박스를 만든다. host 는 크기만 맞춰주고 레이아웃에
    // 관여하지 않는다 — anchor:"center" 가 이 크기를 기준으로 중심을 잡는다.
    element.style.width = `${ICON_PX}px`;
    element.style.height = `${ICON_PX}px`;
    element.innerHTML = spec.html;
    element.title = spec.title;

    const marker = new MarkerCtor({ element, anchor: "center" }).setLngLat([spec.lng, spec.lat]);
    const entry: MarkerEntry = { marker, element, html: spec.html, onClick: spec.onClick };

    if (spec.onClick) {
      element.style.cursor = "pointer";
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        entry.onClick?.();
      });
    }

    marker.addTo(map);
    cache.set(spec.id, entry);
  }

  for (const [id, entry] of cache.entries()) {
    if (!incoming.has(id)) {
      entry.marker.remove();
      cache.delete(id);
    }
  }
}

export interface MapShellProps {
  children?: ReactNode;
  initialCenter?: { lat: number; lng: number };
  /** NCP 스케일 zoom. 내부에서 MapLibre 스케일로 변환한다. */
  initialZoom?: number;
  bikePins?: Array<FrontendDashboardBikePin & { servicePhase?: ServicePhase | null; deliveryCount?: number; ignitionOnAt?: number | null }>;
  stationPins?: FrontendDashboardStationPin[];
  /**
   * 팁 마커 — placeholder. 실제 마커 렌더링 및 양방향 연동은 Task 8 에서 추가.
   */
  tipPins?: FrontendTipPin[];
  onTipSelect?: (id: string) => void;
  onBikeSelect?: (bikeId: string) => void;
  onStationSelect?: (stationId: string) => void;
  /**
   * 현재 선택된 차량 id. 해당 마커를 흰 테두리 + 강조(scale) 로 구분 표기한다.
   * 마커 클릭 / 테이블 행 클릭 어느 쪽으로 선택되든 동일하게 반영된다.
   */
  selectedBikeId?: string | null;
  /**
   * 검색 결과 선택 시 해당 좌표로 지도를 팬/줌. 같은 좌표를 두 번 누르면
   * 객체 identity 가 매번 새로 생겨 effect 가 다시 발화하도록 부모에서
   * 새 객체로 넘긴다. null 이면 아무 동작 없음.
   */
  targetLocation?: { lat: number; lng: number; zoom?: number } | null;
  /**
   * 첫 마커 fit 시 적용할 padding. 기본 사방 48px. 전체화면 모드처럼 캔버스 위에
   * floating 헤더 / 필터 바가 떠 있는 화면은 상단 padding 을 더 크게 줘서 마커가
   * 그 floating 영역 뒤에 박히지 않게.
   */
  fitBoundsPadding?: { top: number; right: number; bottom: number; left: number };
  /**
   * 선택된 차량의 이동 경로 waypoints. non-null + length >= 2 이면 파랑 실선 표시.
   * null 이면 경로선 제거. useTrailWaypoints 훅 결과를 그대로 전달.
   */
  trailWaypoints?: ReadonlyArray<{ lat: number; lng: number }> | null;
  /**
   * 포커스 모드에서 선택 차량의 배송지(destination) 마커. tip/station 과 동일한
   * lifecycle 의 별도 레이어로 렌더된다. 진행 중(`completed: false`)은 컬러 +
   * (있으면) 순번, 완료(`completed: true`)는 회색 + 체크로 시각 구분한다.
   * 빈 배열/미전달 이면 배송지 마커 없음(= 포커스 해제 시 제거).
   */
  dispatchPins?: Array<{
    id: string;
    lat: number;
    lng: number;
    label: string;
    address?: string | null;
    sequence?: number | null;
    completed: boolean;
  }>;
  /**
   * 포커스 진입(선택 변경) 시 "선택 차량 + 모든 배송지" 를 한 화면에 맞추는
   * 1회성 fitBounds 트리거. `trigger` 숫자가 바뀔 때만 발화하므로 폴링으로
   * dispatchPins 가 갱신돼도 재중심하지 않는다(자동 따라가기 off). null 이면
   * (= 포커스 해제) 아무 동작 없음.
   */
  focusBounds?: { points: ReadonlyArray<{ lat: number; lng: number }>; trigger: number } | null;
}

const DEFAULT_FIT_BOUNDS_PADDING = { top: 48, right: 48, bottom: 48, left: 48 };

export function MapShell({
  children,
  initialCenter = SEOUL_DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
  bikePins = [],
  stationPins = [],
  tipPins = [],
  onTipSelect,
  onBikeSelect,
  onStationSelect,
  selectedBikeId = null,
  targetLocation = null,
  fitBoundsPadding = DEFAULT_FIT_BOUNDS_PADDING,
  trailWaypoints = null,
  dispatchPins = [],
  focusBounds = null,
}: MapShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const bikeMarkerCacheRef = useRef<Map<string, MarkerEntry>>(new Map());
  const stationMarkerCacheRef = useRef<Map<string, MarkerEntry>>(new Map());
  const tipMarkerCacheRef = useRef<Map<string, MarkerEntry>>(new Map());
  const dispatchMarkerCacheRef = useRef<Map<string, MarkerEntry>>(new Map());
  /** focusBounds 마지막 처리 trigger. 같은 trigger 면 fit 재실행 안 함. */
  const lastFocusTriggerRef = useRef<number>(-1);
  /** 첫 fit 을 이미 했는지. 이후 핀 목록이 바뀌어도 재중심하지 않는다. */
  const hasFittedRef = useRef(false);
  const onBikeSelectRef = useRef(onBikeSelect);
  const onStationSelectRef = useRef(onStationSelect);
  const onTipSelectRef = useRef(onTipSelect);

  // 지도를 새로 만들 때마다 증가 (테마 전환 등). 마커 effect 들이 이 값을 보고
  // 새 지도에 다시 붙는다 — 핀 목록 자체는 그대로여도.
  const [mapVersion, setMapVersion] = useState(0);
  const [firstFitReady, setFirstFitReady] = useState(false);
  /** 배경 타일 상태. 마커는 이것과 무관하게 그려진다. */
  const [basemap, setBasemap] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    onBikeSelectRef.current = onBikeSelect;
    onStationSelectRef.current = onStationSelect;
    onTipSelectRef.current = onTipSelect;
  }, [onBikeSelect, onStationSelect, onTipSelect]);

  const theme = useSyncExternalStore(subscribeTheme, readDocumentTheme, () => "light");
  const styleUrl = theme === "dark" ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

  /**
   * maplibre-gl 은 동적으로 불러온다. 두 가지를 동시에 얻는다 — Next.js 가 이
   * 컴포넌트를 서버에서 렌더할 때 `window` 를 만지는 모듈이 평가되지 않고,
   * 270KB(gzip) 짜리 청크가 첫 페인트를 막지 않는다.
   */
  const [mapLib, setMapLib] = useState<typeof import("maplibre-gl") | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("maplibre-gl")
      .then((module) => {
        // Map 을 만들기 전에 지정해야 한다 — 워커 풀은 첫 지도 생성 시점에 뜬다.
        module.setWorkerUrl(MAPLIBRE_WORKER_URL);
        if (!cancelled) setMapLib(module);
      })
      .catch(() => {
        if (!cancelled) setBasemap("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 지도 생성. 테마가 바뀌면 styleUrl 이 바뀌고, 아래 JSX 가 캔버스 <div> 를
  // styleUrl 로 keying 하므로 컨테이너째 새로 만들어진다.
  useEffect(() => {
    if (!mapLib) return;
    const container = containerRef.current;
    if (!container) return;
    // 마커 캐시는 effect 진입 시점에 잡아둔다. 정리 함수가 ref 를 다시 읽으면
    // 그 사이 다른 지도의 캐시로 바뀌었을 수 있어, 이 지도가 만든 마커를 지운다는
    // 보장이 사라진다.
    const markerCaches = [
      bikeMarkerCacheRef.current,
      stationMarkerCacheRef.current,
      tipMarkerCacheRef.current,
      dispatchMarkerCacheRef.current
    ];

    const map = new mapLib.Map({
      container,
      style: styleUrl,
      center: [initialCenter.lng, initialCenter.lat],
      zoom: toMapZoom(initialZoom),
      // OSM 데이터는 ODbL 이라 출처 표기가 필수다. 기본 컨트롤을 그대로 쓰되
      // 좁은 화면에서 패널을 가리지 않도록 compact 로 접어둔다.
      attributionControl: { compact: true }
    });
    mapRef.current = map;
    setMapVersion((version) => version + 1);

    // 배경 타일이 안 뜨는 상태를 조용히 빈 화면으로 두지 않는다. 마커는 계속
    // 보이므로, 배경만 없는 상태임을 명시해야 운영자가 "지도가 죽었나" 를 판단한다.
    setBasemap("loading");
    const styleTimer = window.setTimeout(() => {
      if (!map.isStyleLoaded()) setBasemap("unavailable");
    }, BASEMAP_TIMEOUT_MS);
    const onLoad = () => {
      window.clearTimeout(styleTimer);
      setBasemap("ready");
    };
    map.once("load", onLoad);

    return () => {
      window.clearTimeout(styleTimer);
      // 마커를 먼저 떼고 지도를 없앤다. 순서가 반대면 죽은 지도에 붙은 마커를
      // 만지게 된다.
      for (const cache of markerCaches) {
        for (const entry of cache.values()) entry.marker.remove();
        cache.clear();
      }
      hasFittedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, [mapLib, styleUrl, initialCenter.lat, initialCenter.lng, initialZoom]);

  // 현재 줌 추적 (NCP 스케일로 환산해서 보관). 라벨 표시 임계값
  // (LABEL_VISIBLE_ZOOM) 위/아래 전환 시 마커 effect 가 재실행되어 HTML 을 다시 그린다.
  const [currentZoom, setCurrentZoom] = useState(initialZoom);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onZoom = () => setCurrentZoom(fromMapZoom(map.getZoom()));
    map.on("zoom", onZoom);
    return () => {
      map.off("zoom", onZoom);
    };
  }, [mapLib, mapVersion]);

  // Pan/zoom to a search target when the parent supplies one. Each click on
  // a search result hands us a freshly-constructed object so this effect
  // re-fires even when the operator picks the same pin twice in a row.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !targetLocation) return;
    map.setCenter([targetLocation.lng, targetLocation.lat]);
    if (targetLocation.zoom !== undefined) {
      map.setZoom(toMapZoom(targetLocation.zoom));
    }
  }, [mapLib, targetLocation, mapVersion]);

  // 지도 첫 표시 시 모든 마커(차량 + BSS) 가 한 화면에 들어오도록 zoom-to-layer.
  // 한 번만 수행하고(hasFittedRef), 그 뒤 폴링으로 핀이 갱신돼도 운영자가 맞춰둔
  // 화면을 뺏지 않는다. fit 이 끝나면 로딩 오버레이를 걷는다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || hasFittedRef.current) return;

    const all: { lat: number; lng: number }[] = [];
    for (const pin of bikePins) all.push({ lat: pin.latitude, lng: pin.longitude });
    for (const pin of stationPins) all.push({ lat: pin.latitude, lng: pin.longitude });

    hasFittedRef.current = true;

    if (all.length === 1) {
      // 핀 한 개면 fitBounds 가 max-zoom 까지 끌어버려 너무 가까워진다 —
      // 중심만 옮기고 기본 줌을 유지.
      map.setCenter([all[0].lng, all[0].lat]);
    } else if (all.length > 1) {
      let west = all[0].lng;
      let east = all[0].lng;
      let south = all[0].lat;
      let north = all[0].lat;
      for (const point of all) {
        if (point.lng < west) west = point.lng;
        if (point.lng > east) east = point.lng;
        if (point.lat < south) south = point.lat;
        if (point.lat > north) north = point.lat;
      }
      const bounds: LngLatBoundsLike = [
        [west, south],
        [east, north]
      ];
      map.fitBounds(bounds, { padding: fitBoundsPadding, animate: false });
    }
  }, [mapLib, bikePins, stationPins, mapVersion, fitBoundsPadding]);

  /**
   * 로딩 오버레이 해제. **첫-fit effect 와 분리해 둔다.**
   *
   * 한 곳에 두면 이렇게 막힌다 — 핀이 폴링으로 갱신될 때마다 fit effect 가 다시
   * 돌면서 cleanup 이 대기 중인 타이머·리스너를 지우는데, 재실행은 `hasFittedRef`
   * 때문에 곧바로 return 해서 다시 걸지 않는다. 그러면 오버레이가 영영 안 걷히고
   * 지도가 통째로 가려진다. 실제로 그렇게 났다.
   *
   * 이 effect 는 지도 인스턴스에만 의존하므로 한 번 걸면 끝까지 산다. 타일이 끝내
   * 안 오는 환경에서도 fallback 타이머가 오버레이를 걷는다 — 배경이 없어도 마커는
   * 그려지므로 화면을 계속 가릴 이유가 없다.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let done = false;
    const finalize = () => {
      if (done) return;
      done = true;
      setFirstFitReady(true);
    };
    const fallback = window.setTimeout(finalize, 1_500);
    map.once("idle", finalize);
    return () => {
      window.clearTimeout(fallback);
      map.off("idle", finalize);
    };
  }, [mapLib, mapVersion]);

  // 차량 마커.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLib) return;
    const showLabel = currentZoom >= LABEL_VISIBLE_ZOOM;
    syncMarkerLayer(
      map,
      mapLib.Marker,
      bikeMarkerCacheRef.current,
      bikePins.map((pin) => ({
        id: pin.bikeId,
        lat: pin.latitude,
        lng: pin.longitude,
        title: pin.pinLabel ?? pin.plateNumber,
        html: bikeMarkerHtml(
          pin.pinLabel ?? pin.plateNumber,
          showLabel,
          pin.servicePhase,
          pin.deliveryCount,
          pin.ignitionOnAt,
          pin.serviceType,
          pin.bikeId === selectedBikeId,
          pin.currentDispatchCustomerName,
          pin.connectionStatus,
          pin.ignitionStatus,
          pin.wheelType
        ),
        onClick: onBikeSelectRef.current ? () => onBikeSelectRef.current?.(pin.bikeId) : undefined
      }))
    );
  }, [mapLib, bikePins, mapVersion, currentZoom, selectedBikeId]);

  // BSS 마커 — 차량과 동일한 스타일, 색만 `--rm-battery-high` 로 구분.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLib) return;
    const showLabel = currentZoom >= LABEL_VISIBLE_ZOOM;
    syncMarkerLayer(
      map,
      mapLib.Marker,
      stationMarkerCacheRef.current,
      stationPins.map((pin) => ({
        id: pin.stationId,
        lat: pin.latitude,
        lng: pin.longitude,
        title: pin.pinLabel ?? pin.name,
        html: stationMarkerHtml(pin.name, showLabel),
        onClick: onStationSelectRef.current
          ? () => onStationSelectRef.current?.(pin.stationId)
          : undefined
      }))
    );
  }, [mapLib, stationPins, mapVersion, currentZoom]);

  // 팁 마커 — 위치 기반 운영 팁. 클릭 시 하단 팁 패널 행과 양방향 연동.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLib) return;
    const showLabel = currentZoom >= LABEL_VISIBLE_ZOOM;
    syncMarkerLayer(
      map,
      mapLib.Marker,
      tipMarkerCacheRef.current,
      tipPins.map((pin) => ({
        id: pin.id,
        lat: pin.latitude,
        lng: pin.longitude,
        title: pin.address,
        html: tipMarkerHtml(pin.address, showLabel),
        onClick: onTipSelectRef.current ? () => onTipSelectRef.current?.(pin.id) : undefined
      }))
    );
  }, [mapLib, tipPins, mapVersion, currentZoom]);

  // 배송지 마커 — 포커스 모드에서 선택 차량의 배차 주문 위치.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLib) return;
    const showLabel = currentZoom >= LABEL_VISIBLE_ZOOM;
    syncMarkerLayer(
      map,
      mapLib.Marker,
      dispatchMarkerCacheRef.current,
      dispatchPins.map((pin) => ({
        id: pin.id,
        lat: pin.lat,
        lng: pin.lng,
        title: pin.address ?? pin.label,
        html: destinationMarkerHtml(
          pin.label,
          pin.address ?? null,
          showLabel,
          pin.completed,
          pin.sequence ?? null
        )
      }))
    );
  }, [mapLib, dispatchPins, mapVersion, currentZoom]);

  // 포커스 fitBounds — 첫-fit 과 별개. focusBounds.trigger 가 바뀔 때만 1회
  // 발화하고, 그 후 폴링으로 dispatchPins 가 갱신돼도 재중심하지 않는다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusBounds || focusBounds.points.length === 0) return;
    if (focusBounds.trigger === lastFocusTriggerRef.current) return;
    lastFocusTriggerRef.current = focusBounds.trigger;

    const points = focusBounds.points;
    if (points.length === 1) {
      map.setCenter([points[0].lng, points[0].lat]);
      return;
    }
    let west = points[0].lng;
    let east = points[0].lng;
    let south = points[0].lat;
    let north = points[0].lat;
    for (const point of points) {
      if (point.lng < west) west = point.lng;
      if (point.lng > east) east = point.lng;
      if (point.lat < south) south = point.lat;
      if (point.lat > north) north = point.lat;
    }
    map.fitBounds(
      [
        [west, south],
        [east, north]
      ],
      { padding: fitBoundsPadding, animate: false }
    );
  }, [mapLib, focusBounds, mapVersion, fitBoundsPadding]);

  /**
   * 경로 trail — GeoJSON source + line layer 한 쌍.
   *
   * NCP Polyline 시절에는 인스턴스 생성 effect 와 path 갱신 effect 를 나눠야 했다.
   * `setMap(map)` 이 내부적으로 detach→reattach 라서 250ms tick 마다 부르면 선이
   * 깜빡였기 때문이다. MapLibre 는 source 데이터만 갈아끼우면 되므로 그 분리가
   * 필요 없어졌다.
   *
   * 스타일이 아직 로드 전이면 source 를 못 만든다. `load` 를 한 번 기다렸다가
   * 같은 함수를 다시 돌린다.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const coordinates =
      trailWaypoints && trailWaypoints.length >= 2
        ? trailWaypoints.map((waypoint) => [waypoint.lng, waypoint.lat])
        : [];
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates }
    };

    const apply = () => {
      if (!map.getSource(TRAIL_SOURCE_ID)) {
        if (!map.isStyleLoaded()) return;
        map.addSource(TRAIL_SOURCE_ID, { type: "geojson", data });
        map.addLayer({
          id: TRAIL_LAYER_ID,
          type: "line",
          source: TRAIL_SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#3b82f6", "line-width": 4, "line-opacity": 0.85 }
        });
        return;
      }
      (map.getSource(TRAIL_SOURCE_ID) as GeoJSONSource).setData(data);
    };

    if (map.isStyleLoaded()) {
      apply();
      return;
    }
    map.once("load", apply);
    return () => {
      map.off("load", apply);
    };
  }, [mapLib, trailWaypoints, mapVersion]);

  return (
    <>
      <div className="map-shell" data-map-theme={theme} aria-hidden="true">
        <div
          key={`map-canvas-${theme}`}
          ref={containerRef}
          className="map-shell-canvas"
        />
        {/* fit-to-layer 가 끝날 때까지 캔버스를 가리는 로딩 오버레이. 지도가 막
            만들어진 직후의 "서울 기본 중심" 첫 프레임이 운영자 눈에 들어가지
            않도록 함. */}
        {!firstFitReady ? (
          <div className="map-shell-loading" role="status" aria-live="polite">
            <span className="map-shell-spinner" aria-hidden="true" />
            <span>지도 불러오는 중…</span>
          </div>
        ) : null}
        {/* 배경 타일 실패는 화면을 대체하지 않고 위에 얹는다 — 마커(DOM)는 배경과
            무관하게 계속 그려지므로 차량 위치는 그대로 읽을 수 있다. */}
        {firstFitReady && basemap === "unavailable" ? (
          <div className="map-shell-basemap-warning" role="status">
            배경 지도를 불러오지 못했습니다. 마커 위치는 정상입니다.
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
function escapeMarkerText(value: string): string {
  return value.replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;"
  );
}

function labelMarkup(text: string): string {
  // 텍스트는 안전하게 inner text 만 노출 — operator-입력 plate / station name
  // 이 HTML 을 포함할 가능성은 거의 없지만 escape 처리해서 안전망.
  return `<span class="map-marker-label">${escapeMarkerText(text)}</span>`;
}

/**
 * 서비스 상태 배지 HTML.
 * position:absolute 로 내장하고 wrapper 에 overflow:visible 을 준다.
 *
 * 배송형(CALL/SINGLE/OTHER, undefined 포함): MOVING=파랑 "배송 중", WORKING/IDLE=회색 "대기"
 * 청소형(SEQUENTIAL/ROUND):                  MOVING=파랑 "이동 중", WORKING=앰버 "작업 중", IDLE=회색 "대기 중"
 * servicePhase === null 이면 빈 문자열 (시뮬레이션 대상 아님 → 배지 없음).
 */
function serviceBadgeMarkup(phase: ServicePhase, deliveryCount: number, serviceType?: ServiceType): string {
  let bg: string;
  let label: string;
  if (!serviceType || !isCleaningServiceType(serviceType)) {
    const isMoving = phase === "MOVING";
    bg = isMoving ? "#3b82f6" : "#6b7280";
    label = isMoving ? "배송 중" : "대기";
  } else {
    // 청소형(SEQUENTIAL/ROUND)
    if (phase === "MOVING")       { bg = "#3b82f6"; label = "이동 중"; }
    else if (phase === "WORKING") { bg = "#f59e0b"; label = "작업 중"; }
    else                          { bg = "#6b7280"; label = "대기 중"; } // IDLE
  }
  const text = `${label} · ${deliveryCount}건`;
  // 배지 자체는 흐름 안의 인라인 칩. 마커 아래 세로 스택(bikeMarkerHtml)에서 상태 칩 위에 쌓인다.
  return (
    `<div style="display:flex;align-items:center;` +
    `height:14px;padding:0 5px;border-radius:3px;font-size:9px;font-weight:600;` +
    `color:#fff;white-space:nowrap;background:${bg};pointer-events:none;">` +
    `${text}</div>`
  );
}

/**
 * 모든 차량 마커 공통 상태 칩. 점 색 = 연결(ONLINE 초록 / 그 외 회색),
 * 텍스트 = 연결|미연결 · 시동 ON|OFF|—. 미연결이면 시동 "—".
 */
function statusChipMarkup(connectionStatus: string | undefined, ignitionStatus: string | undefined): string {
  const online = connectionStatus === "ONLINE";
  const dotColor = online ? "#1d9e75" : "#5f5e5a";
  const conn = online ? "연결" : "미연결";
  const ign = !online ? "—" : ignitionStatus === "ON" ? "ON" : ignitionStatus === "OFF" ? "OFF" : "—";
  return (
    `<div style="display:inline-flex;align-items:center;gap:4px;background:rgba(20,22,27,0.85);` +
    `color:#cfd3dc;font-size:10px;line-height:1;padding:2px 6px;border-radius:9px;` +
    `border:0.5px solid rgba(255,255,255,0.12);white-space:nowrap;">` +
    `<span style="width:7px;height:7px;border-radius:50%;background:${dotColor};"></span>` +
    `${conn} · 시동 ${ign}</div>`
  );
}

/**
 * 시동 켜짐 말풍선 HTML.
 * CSS animation (.map-ignition-bubble) 으로 4초 후 자동 소멸.
 * markerWrapper 안에 badge 와 함께 넣는다 (아래 wrapper 주석 참고).
 */
function ignitionBubbleMarkup(customerName?: string | null): string {
  const who = customerName ? `${escapeMarkerText(customerName)} ` : "";
  return `<div class="map-ignition-bubble">🔑 ${who}출발</div>`;
}

// 공통 SVG attribute. stroke 기반 line-art 가 currentColor 를 따라간다.
const ICON_SVG_PROPS = `width="${ICON_PX}" height="${ICON_PX}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;

/** 배달 스쿠터 silhouette — 앞·뒤 바퀴 + 핸들 + 좌석 + 후방 배달박스. 4륜이면 box-truck. */
function bikeIconSvg(wheelType?: string): string {
  if (wheelType === "FOUR_WHEEL") {
    return `<svg ${ICON_SVG_PROPS}>
    <path d="M2.5 16 V7.5 H13 V16"/>
    <path d="M13 10.5 H16.5 L20.5 13.5 V16 H13"/>
    <path d="M2.5 16 H4.3"/>
    <path d="M8.2 16 H14.8"/>
    <path d="M18.7 16 H20.5"/>
    <path d="M16.5 10.7 V13.5 H20.2"/>
    <circle cx="6.3" cy="17.6" r="1.9"/>
    <circle cx="16.8" cy="17.6" r="1.9"/>
  </svg>`;
  }
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

/** 운영 팁 silhouette — location pin (물방울 외곽 + 가운데 점). */
function tipIconSvg(): string {
  return `<svg ${ICON_SVG_PROPS}>
    <path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/>
    <circle cx="12" cy="10" r="2.5"/>
  </svg>`;
}

/**
 * 배송지 silhouette — 깃발 핀(목적지). 진행 중이면 컬러 stroke 를 currentColor
 * 로 따라가고, 완료면 가운데에 체크를 추가로 그린다.
 */
function destinationIconSvg(completed: boolean): string {
  const check = completed
    ? `<path d="M9 9.5 L11 11.5 L15 7" stroke-width="2"/>`
    : "";
  return `<svg ${ICON_SVG_PROPS}>
    <path d="M6 21 V4"/>
    <path d="M6 4 H17 L14.5 8 L17 12 H6"/>
    ${check}
  </svg>`;
}

/**
 * 마커 래퍼. `color: var(...)` 가 SVG `stroke="currentColor"` 로 전파되어
 * 색을 가르고, drop-shadow 로 지도 배경 위 가시성을 확보한다. `line-height: 0`
 * 은 SVG 가 inline-element 라 기본적으로 baseline 여백을 만드는 걸 잘라 — 그
 * 여백이 anchor 계산과 어긋나면 마커가 lat/lng 점 위에서 미세하게 떠 보임.
 *
 * extras(badge + bubble HTML) 를 넘기면 wrapper 내부 position:absolute 자식으로 삽입하고
 * wrapper 에 overflow:visible + position:relative 를 추가한다. 배지는 28×28 아이콘
 * 박스 밖으로 넘쳐 그려지므로 wrapper 가 자를 수 없어야 한다.
 */
function markerWrapper(iconSvg: string, colorVar: string, badge?: string, selected?: boolean): string {
  const extraStyle = badge
    ? "position:relative;overflow:visible;"
    : "";
  // 선택 강조: 흰 테두리 + 색상 링 halo + 살짝 확대. border-radius 로 둥근 halo,
  // box-shadow 는 overflow 와 무관하게 박스 밖으로 그려져 라벨/배지를 가리지 않는다.
  const selectedStyle = selected
    ? `border-radius:50%;box-shadow:0 0 0 2px #fff,0 0 0 5px var(${colorVar});transform:scale(1.18);`
    : "";
  return (
    `<div style="pointer-events:auto;color:var(${colorVar});width:${ICON_PX}px;` +
    `height:${ICON_PX}px;line-height:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));${extraStyle}${selectedStyle}">` +
    `${iconSvg}${badge ?? ""}` +
    `</div>`
  );
}

/** BSS 마커 — 충전 배터리 아이콘 + (옵션) 스테이션 이름 라벨. */
function stationMarkerHtml(name: string, showLabel: boolean): string {
  const wrapped = markerWrapper(stationIconSvg(), "--rm-battery-mid");
  if (!showLabel) return wrapped;
  return `<div style="position:relative;pointer-events:auto;width:${ICON_PX}px;height:${ICON_PX}px;">${labelMarkup(name)}${wrapped}</div>`;
}

/** 팁 마커 — 보라색 location-pin 아이콘 + (옵션) 주소 라벨. */
function tipMarkerHtml(address: string, showLabel: boolean): string {
  const wrapped = markerWrapper(tipIconSvg(), "--rm-tip");
  if (!showLabel) return wrapped;
  return `<div style="position:relative;pointer-events:auto;width:${ICON_PX}px;height:${ICON_PX}px;">${labelMarkup(address)}${wrapped}</div>`;
}

/** 순번 배지 — 배송지 핀 좌상단에 작은 원형 숫자. (sequence 가 있을 때만) */
function sequenceBadgeMarkup(sequence: number, completed: boolean): string {
  const bg = completed ? "var(--rm-text-muted)" : "var(--rm-battery-mid)";
  return (
    `<div style="position:absolute;top:-6px;right:-6px;min-width:16px;height:16px;` +
    `display:flex;align-items:center;justify-content:center;padding:0 3px;border-radius:8px;` +
    `background:${bg};color:#fff;font-size:10px;font-weight:700;line-height:1;` +
    `box-shadow:0 0 0 1.5px #fff;pointer-events:none;">${sequence}</div>`
  );
}

/**
 * 배송지(destination) 마커 — 깃발 핀 아이콘 + (옵션) 주소 라벨 + (옵션) 순번 배지.
 *
 * 진행 중(`completed: false`): `--rm-battery-mid` 컬러 핀(차량 마커 --rm-accent 와 구분), sequence 가 있으면 순번 배지.
 * 완료(`completed: true`):     `--rm-text-muted` 회색 + 체크(✓), 순번 배지도 회색.
 *
 * bike/tip 마커와 동일하게 markerWrapper(overflow:visible) 안에 순번 배지를
 * position:absolute 자식으로 내장한다.
 */
function destinationMarkerHtml(
  label: string,
  address: string | null,
  showLabel: boolean,
  completed: boolean,
  sequence: number | null
): string {
  const colorVar = completed ? "--rm-text-muted" : "--rm-battery-mid";
  const badge = sequence != null ? sequenceBadgeMarkup(sequence, completed) : undefined;
  const wrapped = markerWrapper(destinationIconSvg(completed), colorVar, badge);
  if (!showLabel) return wrapped;
  const labelText = address ?? label;
  return `<div style="position:relative;pointer-events:auto;width:${ICON_PX}px;height:${ICON_PX}px;">${labelMarkup(labelText)}${wrapped}</div>`;
}

/**
 * 차량 마커 — 스쿠터 아이콘 + (옵션) 번호판 라벨 + (옵션) 서비스 상태 배지 + (옵션) 시동 말풍선.
 *
 * servicePhase != null 이면 배지 포함. ignitionOnAt 이 4초 이내이면 말풍선 포함.
 * 배지·말풍선은 markerWrapper(overflow:visible + position:relative) 안 position:absolute 자식.
 */
function bikeMarkerHtml(
  plateNumber: string,
  showLabel: boolean,
  servicePhase?: ServicePhase | null,
  deliveryCount?: number,
  ignitionOnAt?: number | null,
  serviceType?: ServiceType,
  selected?: boolean,
  currentDispatchCustomerName?: string | null,
  connectionStatus?: string,
  ignitionStatus?: string,
  wheelType?: string
): string {
  const badge =
    servicePhase != null
      ? serviceBadgeMarkup(servicePhase, deliveryCount ?? 0, serviceType)
      : "";
  const statusChip = statusChipMarkup(connectionStatus, ignitionStatus);
  // 배송 배지(있을 때) + 상태 칩을 마커 아래에 하나의 절대배치 세로 스택으로 중앙 정렬해 쌓는다.
  // (배지를 절대배치하면 칩과 겹치므로, 스택 컨테이너만 절대배치하고 내부는 흐름에 둔다.)
  const badgeArea =
    `<div style="position:absolute;top:${BADGE_TOP_OFFSET}px;left:50%;transform:translateX(-50%);` +
    `display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;">` +
    `${badge}${statusChip}</div>`;
  const showBubble = isCleaningServiceType(serviceType) && ignitionOnAt != null && Date.now() - ignitionOnAt < 4_000;
  const bubble = showBubble ? ignitionBubbleMarkup(currentDispatchCustomerName) : "";
  const extras = badgeArea + bubble;
  const wrapped = markerWrapper(bikeIconSvg(wheelType), "--rm-accent", extras, selected);
  if (!showLabel) return wrapped;
  return (
    `<div style="position:relative;pointer-events:auto;width:${ICON_PX}px;height:${ICON_PX}px;">` +
    `${labelMarkup(plateNumber)}${wrapped}` +
    `</div>`
  );
}
