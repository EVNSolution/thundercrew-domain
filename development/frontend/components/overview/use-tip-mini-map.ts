"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

import { MAP_STYLE_LIGHT, loadMapLibre, toMapZoom } from "@/lib/maps/maplibre";

interface UseTipMiniMapOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  initialCenter: { lat: number; lng: number };
  /** EditDialog 는 기존 좌표로 초기 핀을 씨딩하고, CreateDialog 는 null 을 넘긴다. */
  initialPin?: { lat: number; lng: number } | null;
  /** NCP 스케일 zoom. 내부에서 MapLibre 스케일로 변환한다. */
  zoom: number;
}

interface UseTipMiniMapResult {
  lat: number | null;
  lng: number | null;
  mapError: string | null;
}

/**
 * 팁 다이얼로그(생성/편집) 공용 미니맵 라이프사이클 훅.
 *
 * 컨테이너에 MapLibre 지도를 1회 생성하고, 클릭으로 단일 핀을 재배치하면서
 * lat/lng state 를 갱신한다. `initialPin` 이 있으면 그 좌표에 초기 핀을 찍고
 * state 도 그 값으로 시작한다.
 *
 * 초기 좌표/줌은 mount 시점 값으로 한 번만 init 한다. 부모는 다이얼로그를 행마다
 * `key` 로 새로 마운트하므로, deps 를 stable 입력으로 둬도 사용자가 옮긴 핀을
 * 재초기화가 덮어쓰지 않는다.
 */
export function useTipMiniMap({
  containerRef,
  initialCenter,
  initialPin = null,
  zoom,
}: UseTipMiniMapOptions): UseTipMiniMapResult {
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinMarkerRef = useRef<MapLibreMarker | null>(null);

  const [lat, setLat] = useState<number | null>(initialPin ? initialPin.lat : null);
  const [lng, setLng] = useState<number | null>(initialPin ? initialPin.lng : null);
  const [mapError, setMapError] = useState<string | null>(null);

  // mount 시점 값을 snapshot 해 init 을 한 번만 돌린다. effect deps 는 이
  // stable 값들이라 부모가 같은 좌표로 리렌더해도 핀 이동이 덮어써지지 않는다.
  const initialCenterLat = initialCenter.lat;
  const initialCenterLng = initialCenter.lng;
  const initialPinLat = initialPin ? initialPin.lat : null;
  const initialPinLng = initialPin ? initialPin.lng : null;

  useEffect(() => {
    let cancelled = false;

    loadMapLibre()
      .then((maplibre) => {
        if (cancelled) return;
        const container = containerRef.current;
        if (!container || mapRef.current) return;

        const map = new maplibre.Map({
          container,
          style: MAP_STYLE_LIGHT,
          center: [initialCenterLng, initialCenterLat],
          zoom: toMapZoom(zoom),
          attributionControl: { compact: true }
        });
        mapRef.current = map;

        // 기존 좌표가 있으면 초기 핀 표시 (state 는 이미 그 값으로 초기화됨).
        if (initialPinLat !== null && initialPinLng !== null) {
          pinMarkerRef.current = new maplibre.Marker()
            .setLngLat([initialPinLng, initialPinLat])
            .addTo(map);
        }

        // 클릭한 자리로 핀을 옮긴다. 핀이 이미 있으면 위치만 바꾼다 — 지우고 다시
        // 만들면 깜빡인다.
        map.on("click", (event) => {
          const { lat: clickedLat, lng: clickedLng } = event.lngLat;
          setLat(clickedLat);
          setLng(clickedLng);
          if (pinMarkerRef.current) {
            pinMarkerRef.current.setLngLat([clickedLng, clickedLat]);
            return;
          }
          pinMarkerRef.current = new maplibre.Marker()
            .setLngLat([clickedLng, clickedLat])
            .addTo(map);
        });
      })
      .catch((error) => {
        // 삼키면 안 된다. 이 화면은 좌표를 찍는 곳이라 지도가 없으면 아무것도 못 하는데,
        // 안내 문구만 뜨고 원인이 콘솔에도 안 남으면 진단할 방법이 없다.
        console.error("[tip-mini-map] 지도 초기화 실패", error);
        if (!cancelled) setMapError("지도를 불러오지 못했습니다.");
      });

    return () => {
      cancelled = true;
      pinMarkerRef.current?.remove();
      pinMarkerRef.current = null;
      // map.remove() 가 자기 리스너까지 정리하므로 click 을 따로 뗄 필요가 없다.
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [containerRef, initialCenterLat, initialCenterLng, initialPinLat, initialPinLng, zoom]);

  return { lat, lng, mapError };
}
