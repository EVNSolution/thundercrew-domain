"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BikeDetailPanel } from "@/components/dashboard/BikeDetailPanel";
import { MapShell } from "@/components/dashboard/MapShell";
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
  // Computing `selectedPin` from `selectedBikeId` purely in render avoids
  // the set-state-in-effect anti-pattern that React 19's lint rule blocks.
  const selectedPin = useMemo(() => {
    if (!selectedBikeId) return null;
    return state.data.bikePins.find((pin) => pin.bikeId === selectedBikeId) ?? null;
  }, [selectedBikeId, state.data.bikePins]);

  const handleBikeSelect = useCallback((bikeId: string) => {
    setSelectedBikeId(bikeId);
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedBikeId(null);
  }, []);

  return (
    <>
      <MapShell
        bikePins={state.data.bikePins}
        stationPins={state.data.stationPins}
        onBikeSelect={handleBikeSelect}
      />
      {state.notice ? (
        <div className="dashboard-map-notice" role="status" aria-live="polite">
          <strong>지도 데이터 안내</strong>
          <span>{state.notice}</span>
        </div>
      ) : null}
      {selectedPin ? (
        <BikeDetailPanel pin={selectedPin} onClose={handlePanelClose} />
      ) : null}
    </>
  );
}
