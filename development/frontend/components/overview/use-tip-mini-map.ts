"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { loadNcpMapsSdk } from "@/lib/maps/load-ncp-sdk";
import type {
  NaverEventListener,
  NaverMapClickEvent,
  NaverMapInstance,
  NaverMarkerInstance,
} from "@/types/naver-maps";

interface UseTipMiniMapOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  initialCenter: { lat: number; lng: number };
  /** EditDialog 는 기존 좌표로 초기 핀을 씨딩하고, CreateDialog 는 null 을 넘긴다. */
  initialPin?: { lat: number; lng: number } | null;
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
 * NCP base SDK 를 로드해 컨테이너에 `naver.maps.Map` 을 1회 생성하고, 클릭으로
 * 단일 핀(`Marker`) 을 재배치하면서 lat/lng state 를 갱신한다. `initialPin` 이
 * 있으면 그 좌표에 초기 핀을 찍고 state 도 그 값으로 시작한다.
 *
 * 누수 방지: 비동기 init 에서 만든 click 리스너 핸들을 ref 로 동기 cleanup 까지
 * 브리지해, 언마운트 시 `Event.removeListener` 로 리스너를 떼고 marker 를
 * 해제(`setMap(null)`)한 뒤 map 인스턴스를 `destroy?.()` 로 파괴한다.
 * (MapShell 의 zoom_changed effect 와 동일한 removeListener 계약을 따른다.)
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
  const mapRef = useRef<NaverMapInstance | null>(null);
  const pinMarkerRef = useRef<NaverMarkerInstance | null>(null);
  const listenerRef = useRef<NaverEventListener | null>(null);

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
    loadNcpMapsSdk()
      .then(() => {
        if (cancelled) return;
        const naver = window.naver;
        const container = containerRef.current;
        if (!naver?.maps?.Map || !container || mapRef.current) return;

        const map = new naver.maps.Map(container, {
          center: new naver.maps.LatLng(initialCenterLat, initialCenterLng),
          zoom,
        });
        mapRef.current = map;

        // 기존 좌표가 있으면 초기 핀 표시 (state 는 이미 그 값으로 초기화됨).
        if (initialPinLat !== null && initialPinLng !== null) {
          pinMarkerRef.current = new naver.maps.Marker({
            position: new naver.maps.LatLng(initialPinLat, initialPinLng),
            map,
          });
        }

        if (!naver.maps.Event) return;
        listenerRef.current = naver.maps.Event.addListener(map, "click", (event: unknown) => {
          const coord = (event as NaverMapClickEvent).coord;
          if (!coord) return;
          setLat(coord.lat());
          setLng(coord.lng());
          pinMarkerRef.current?.setMap(null);
          pinMarkerRef.current = new naver.maps.Marker({ position: coord, map });
        });
      })
      .catch(() => {
        if (!cancelled) setMapError("지도를 불러오지 못했습니다.");
      });

    return () => {
      cancelled = true;
      const naver = typeof window !== "undefined" ? window.naver : undefined;
      if (listenerRef.current && naver?.maps?.Event) {
        naver.maps.Event.removeListener(listenerRef.current);
      }
      listenerRef.current = null;
      pinMarkerRef.current?.setMap(null);
      pinMarkerRef.current = null;
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
  }, [containerRef, initialCenterLat, initialCenterLng, initialPinLat, initialPinLng, zoom]);

  return { lat, lng, mapError };
}
