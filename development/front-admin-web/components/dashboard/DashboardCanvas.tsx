"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BikeDetailPanel } from "@/components/dashboard/BikeDetailPanel";
import { MapShell } from "@/components/dashboard/MapShell";
import {
  MonitoringSearch,
  SEARCH_TARGET_ZOOM,
  type MonitoringSearchMatch
} from "@/components/dashboard/MonitoringSearch";
import { StationDetailPanel } from "@/components/dashboard/StationDetailPanel";
import type { DashboardMapStateResult } from "@/lib/services/dashboard-map-state-data";

const DEFAULT_POLL_INTERVAL_MS = 10_000;

export interface DashboardCanvasProps {
  initial: DashboardMapStateResult;
  pollIntervalMs?: number;
}

/**
 * Client-side wrapper that owns the polling loop and the marker-click
 * detail panel state. The server component does the first fetch (so the
 * page renders SSR-ready), then this component takes over and refreshes
 * the map state on a fixed cadence.
 *
 * Polling deliberately uses our own `/api/dashboard/map-state` route instead
 * of calling `service-ops-api` from the browser — that keeps the service-ops
 * cookie server-side and avoids CORS/credential plumbing.
 */
export function DashboardCanvas({
  initial,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS
}: DashboardCanvasProps) {
  const [state, setState] = useState<DashboardMapStateResult>(initial);
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  // 검색 결과 선택 시 MapShell 에 넘길 팬 좌표. 매 선택마다 새 객체를 박아
  // identity 변경으로 effect 재발화를 유도 (같은 결과 두 번 눌러도 다시 팬).
  const [searchTarget, setSearchTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const pollIntervalRef = useRef(pollIntervalMs);

  useEffect(() => {
    pollIntervalRef.current = pollIntervalMs;
  }, [pollIntervalMs]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function fetchOnce() {
      try {
        const response = await fetch("/api/dashboard/map-state", {
          cache: "no-store",
          credentials: "same-origin"
        });
        if (!response.ok) {
          // Keep the previous snapshot rather than blanking the map.
          return;
        }
        const next = (await response.json()) as DashboardMapStateResult;
        if (!cancelled) {
          setState(next);
        }
      } catch {
        // Swallow — leave the previous snapshot visible. The notice on the
        // map shell is the operator's primary signal that data may be stale.
      }
    }

    function schedule() {
      timer = setTimeout(async () => {
        await fetchOnce();
        if (!cancelled) {
          schedule();
        }
      }, pollIntervalRef.current);
    }

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Resolve the pin against the latest snapshot every render so a polling
  // refresh that drops the selected bike collapses the panel automatically.
  const selectedBikePin = useMemo(() => {
    if (!selectedBikeId) return null;
    return state.data.bikePins.find((pin) => pin.bikeId === selectedBikeId) ?? null;
  }, [selectedBikeId, state.data.bikePins]);

  const selectedStationPin = useMemo(() => {
    if (!selectedStationId) return null;
    return state.data.stationPins.find((pin) => pin.stationId === selectedStationId) ?? null;
  }, [selectedStationId, state.data.stationPins]);

  const handleBikeSelect = useCallback((bikeId: string) => {
    // Mutual exclusion — opening the bike panel closes any open station
    // panel and vice versa, so the operator never has two right-edge panels
    // overlapping.
    setSelectedStationId(null);
    setSelectedBikeId(bikeId);
  }, []);

  const handleStationSelect = useCallback((stationId: string) => {
    setSelectedBikeId(null);
    setSelectedStationId(stationId);
  }, []);

  const handleBikePanelClose = useCallback(() => {
    setSelectedBikeId(null);
  }, []);

  const handleStationPanelClose = useCallback(() => {
    setSelectedStationId(null);
  }, []);

  // 검색 결과 클릭: (1) 지도 팬/줌 — 매번 새 객체로 박아 MapShell effect 재발화
  // (2) 해당 종류의 상세 패널을 동시에 열어서 운영자가 즉시 디테일 확인 가능.
  const handleSearchSelect = useCallback((match: MonitoringSearchMatch) => {
    setSearchTarget({ lat: match.latitude, lng: match.longitude, zoom: SEARCH_TARGET_ZOOM });
    if (match.type === "bike") {
      setSelectedStationId(null);
      setSelectedBikeId(match.id);
    } else {
      setSelectedBikeId(null);
      setSelectedStationId(match.id);
    }
  }, []);

  return (
    <>
      <MapShell
        bikePins={state.data.bikePins}
        stationPins={state.data.stationPins}
        onBikeSelect={handleBikeSelect}
        onStationSelect={handleStationSelect}
        targetLocation={searchTarget}
      />
      <MonitoringSearch
        bikePins={state.data.bikePins}
        stationPins={state.data.stationPins}
        onSelect={handleSearchSelect}
      />
      {state.notice ? (
        <div className="dashboard-map-notice" role="status" aria-live="polite">
          <strong>지도 데이터 안내</strong>
          <span>{state.notice}</span>
        </div>
      ) : null}
      {selectedBikePin ? (
        // key 로 컴포넌트를 재마운트시켜 차량 전환 시 토글 optimistic state
        // 등 내부 useState 가 자연스럽게 초기화되도록 한다.
        <BikeDetailPanel
          key={selectedBikePin.bikeId}
          pin={selectedBikePin}
          onClose={handleBikePanelClose}
        />
      ) : null}
      {selectedStationPin ? (
        <StationDetailPanel pin={selectedStationPin} onClose={handleStationPanelClose} />
      ) : null}
    </>
  );
}
