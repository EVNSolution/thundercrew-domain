import { useEffect, useRef, useState } from 'react';
// maplibre-gl 6 은 default export 가 없다. named import 를 쓴다.
import { Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl';
import { VEHICLE_ICON_PATH } from '../features/control/vehicle-colors';

/**
 * MapLibre GL + OpenFreeMap 지도.
 *
 * DSV 와 같은 조합이다. API 키가 없고 origin allowlist 도 없어서 어느 포트에서든
 * 뜬다 — 프리뷰(8090)에서 바로 동작하는 게 이 스택을 고른 이유다.
 * 기존 Next.js 콘솔의 NCP Maps 는 `ncpKeyId` + origin allowlist 가 필요하다.
 *
 * 마커는 DOM 요소로 붙인다(`maplibregl.Marker`). 지도 마커·순서 번호·레이블을
 * 하나의 시각 단위로 다룬다는 규칙에 맞춰, 마커 하나가 핀 + 레이블을 함께 갖는다.
 */

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';

export interface MapMarkerSpec {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  /** 핀 안에 들어가는 짧은 값. 없으면 점만 찍는다. */
  readonly badge?: string;
  readonly label?: string;
  readonly color: string;
  readonly kind: 'vehicle' | 'station' | 'order';
  readonly selected?: boolean;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * DSV 의 차량 마커 모양을 따른다 — 흰 테두리 원 + 검정 차량 글리프,
 * 레이블은 원 위에 흰 halo 텍스트. DSV 는 이것을 MapLibre symbol 레이어로
 * 그리지만 여기서는 DOM 마커로 만든다. symbol 레이어는 스타일이 로드되지
 * 않으면 아무것도 보이지 않는데, DOM 마커는 배경 지도와 무관하게 그려진다.
 * 배경 타일이 실패해도 차량 위치는 계속 읽혀야 하므로 이 쪽을 택했다.
 */
function buildMarkerElement(spec: MapMarkerSpec, onSelect?: (id: string) => void): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = `map-marker is-${spec.kind}${spec.selected ? ' is-selected' : ''}`;

  // 레이블은 절대 배치로 원 위에 얹는다. 레이아웃에 영향을 주면 원이 좌표에서 밀린다.
  if (spec.label) {
    const label = document.createElement('span');
    label.className = 'map-marker-label';
    label.textContent = spec.label;
    wrapper.append(label);
  }

  const body = document.createElement('span');
  body.className = 'map-marker-body';
  body.style.background = spec.color;

  if (spec.kind === 'vehicle') {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('map-marker-glyph');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', VEHICLE_ICON_PATH);
    svg.append(path);
    body.append(svg);
  } else if (spec.badge) {
    body.textContent = spec.badge;
  }

  wrapper.append(body);

  if (onSelect) {
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('aria-label', spec.label ?? spec.id);
    wrapper.addEventListener('click', (event) => {
      event.stopPropagation();
      onSelect(spec.id);
    });
    wrapper.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(spec.id);
      }
    });
  }

  return wrapper;
}

export function MapCanvas({
  markers,
  center,
  zoom = 11,
  onSelectMarker,
}: {
  markers: readonly MapMarkerSpec[];
  center: { lat: number; lng: number };
  zoom?: number;
  onSelectMarker?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const readyRef = useRef(false);
  /**
   * 배경 지도 로드 상태. 타일이 안 뜨는 것을 조용히 빈 화면으로 두지 않는다.
   * 마커는 지도 로드와 무관하게 계속 보이므로, 배경만 없는 상태를 명시해야
   * 운영자가 "지도가 죽었나"를 판단할 수 있다.
   */
  const [basemap, setBasemap] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = new MapLibreMap({
      container,
      style: OPENFREEMAP_STYLE,
      center: [center.lng, center.lat],
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('load', () => {
      readyRef.current = true;
      setBasemap('ready');
      // 컨테이너가 절대 배치라서 생성 시점에 크기가 0 인 경우가 있다.
      // 그러면 MapLibre 가 보이는 타일을 계산하지 못해 타일을 아예 요청하지 않는다.
      map.resize();
    });
    // 지도 오류를 삼키지 않는다. 타일·스타일 실패가 조용히 빈 화면으로 보이면 안 된다.
    map.on('error', (event) => {
      console.error('[MapCanvas] maplibre error', event.error ?? event);
      setBasemap('unavailable');
    });

    // `load` 는 스타일과 최초 타일이 모두 준비된 뒤에만 발생한다. 소스가
    // 조용히 로드되지 않으면 이벤트도 오류도 오지 않으므로 시간으로 끊는다.
    // 판정은 ref 가 아니라 지도 자체 상태로 한다 — ref 는 StrictMode 재마운트로
    // 초기화되어 신뢰할 수 없다.
    const loadDeadline = window.setTimeout(() => {
      setBasemap(map.isStyleLoaded() ? 'ready' : 'unavailable');
    }, 8_000);
    mapRef.current = map;

    // 개발 중 지도 상태를 콘솔에서 확인할 수 있게 핸들을 노출한다.
    // 프로덕션 빌드에서는 붙지 않는다.
    if (import.meta.env.DEV) {
      (window as unknown as { __tcMap?: MapLibreMap }).__tcMap = map;
    }

    // 사이드바 접힘으로 page-content 폭이 바뀔 때도 지도를 다시 맞춘다.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);

    return () => {
      window.clearTimeout(loadDeadline);
      observer.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // 지도는 한 번만 만든다. center/zoom 변경은 아래 effect 가 처리한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마커 동기화. 매 tick 마다 전부 지우고 다시 만들면 깜빡이므로
  // 기존 마커는 위치만 옮기고 없어진 것만 제거한다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();

    for (const spec of markers) {
      seen.add(spec.id);
      const existing = markersRef.current.get(spec.id);
      if (existing) {
        existing.setLngLat([spec.lng, spec.lat]);
        const element = existing.getElement();
        const body = element.querySelector<HTMLElement>('.map-marker-body');
        if (body) {
          body.style.background = spec.color;
          // 차량 마커는 안에 SVG 글리프가 들어 있어 textContent 로 덮으면 지워진다.
          if (spec.kind !== 'vehicle' && spec.badge !== undefined) {
            body.textContent = spec.badge;
          }
        }
        const labelNode = element.querySelector<HTMLElement>('.map-marker-label');
        if (labelNode && spec.label !== undefined) labelNode.textContent = spec.label;
        element.classList.toggle('is-selected', Boolean(spec.selected));
        continue;
      }
      const marker = new Marker({
        element: buildMarkerElement(spec, onSelectMarker),
        anchor: 'center',
      })
        .setLngLat([spec.lng, spec.lat])
        .addTo(map);
      markersRef.current.set(spec.id, marker);
    }

    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [markers, onSelectMarker]);

  return (
    <>
      <div className="map-canvas" ref={containerRef} aria-label="차량과 주문 위치 지도" />
      {basemap === 'unavailable' && (
        <p className="map-basemap-notice" role="status">
          <b>배경 지도를 불러오지 못했습니다</b>
          차량·주문 위치는 계속 갱신됩니다. 배경 타일(tiles.openfreemap.org)만 표시되지 않습니다.
          네트워크가 이 도메인을 막고 있는지 확인하세요.
        </p>
      )}
    </>
  );
}
