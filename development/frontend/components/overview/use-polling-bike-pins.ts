"use client";

import { useEffect, useRef, useState } from "react";

import type { DashboardMapStateResult } from "@/lib/services/dashboard-map-state-data";
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";

const DEFAULT_POLL_INTERVAL_MS = 30_000;

/** 폴링 주기를 기다리지 않고 즉시 재조회시키는 window 이벤트 이름. */
export const PINS_REFRESH_EVENT = "thundercrew-pins-refresh";

/**
 * SSR 로 받은 초기 핀을 시드로, `/api/dashboard/map-state` 를 고정 주기로
 * 폴링해 최신 bikePins(recentTrack 포함)를 반환한다. 실패하면 직전 스냅샷
 * 유지. 탭이 백그라운드(`document.hidden`)면 폴링을 건너뛴다.
 *
 * service-ops 쿠키는 라우트(서버) 안에 머무르므로 브라우저는 쿠키를 보지
 * 않는다 — DashboardCanvas 와 동일한 이유로 자체 라우트를 친다.
 */
export function usePollingBikePins(
  initialPins: ReadonlyArray<FrontendDashboardBikePin>,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS
): ReadonlyArray<FrontendDashboardBikePin> {
  const [pins, setPins] = useState<ReadonlyArray<FrontendDashboardBikePin>>(initialPins);
  const intervalRef = useRef(pollIntervalMs);

  useEffect(() => {
    intervalRef.current = pollIntervalMs;
  }, [pollIntervalMs]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function fetchOnce() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const response = await fetch("/api/dashboard/map-state", {
          cache: "no-store",
          credentials: "same-origin"
        });
        if (!response.ok) return;
        const next = (await response.json()) as DashboardMapStateResult;
        if (!cancelled) setPins(next.data.bikePins);
      } catch {
        // 이전 스냅샷 유지.
      }
    }

    function schedule() {
      timer = setTimeout(async () => {
        await fetchOnce();
        if (!cancelled) schedule();
      }, intervalRef.current);
    }

    schedule();
    const onRefresh = () => void fetchOnce();
    window.addEventListener(PINS_REFRESH_EVENT, onRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener(PINS_REFRESH_EVENT, onRefresh);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return pins;
}
