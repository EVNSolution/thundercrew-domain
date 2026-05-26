"use client";

import { useMemo } from "react";

import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";

export type TrailWaypoint = { lat: number; lng: number };

/**
 * 선택된 차량의 이동 경로 waypoints 반환.
 *
 * - IMEI=-1 시뮬 차량: FleetSimulationContext 의 routeWaypoints (OSRM fetch 완료분).
 *   EN_ROUTE + routeWaypoints !== null + length >= 2 일 때만 반환.
 *   IDLE 이거나 OSRM fetch 아직 진행 중(routeWaypoints === null)이면 null.
 * - 실제 차량: null (백엔드 API 완성 후 fetchBikeLocationHistory 로 교체).
 * - selectedBikeId === null → null.
 *
 * OSRM fetch 가 완료되면 simulated Map 이 갱신 → 이 훅이 재계산 → MapShell 이
 * Polyline 을 자동으로 표시한다. 별도 polling 불필요.
 */
export function useTrailWaypoints(
  selectedBikeId: string | null
): ReadonlyArray<TrailWaypoint> | null {
  const { simulated } = useFleetSimulation();

  return useMemo(() => {
    if (!selectedBikeId) return null;

    // IMEI=-1 시뮬 차량
    const sim = simulated.get(selectedBikeId);
    if (sim) {
      if (
        sim.phase === "EN_ROUTE" &&
        sim.routeWaypoints !== null &&
        sim.routeWaypoints.length >= 2
      ) {
        return sim.routeWaypoints;
      }
      return null;
    }

    // 실제 차량 — stub: 현재 null. fetchBikeLocationHistory 로 교체 예정.
    return null;
  }, [selectedBikeId, simulated]);
}
