"use client";

import { useMemo } from "react";

import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";

export type TrailWaypoint = { lat: number; lng: number };

/**
 * progress(0~1) 기준으로 전체 polyline waypoints 중 이미 이동한 구간만 반환.
 *
 * walkPolyline 과 동일한 세그먼트 분할 방식을 사용:
 *   totalSegs = waypoints.length - 1
 *   pos = progress * totalSegs → segIndex(정수) + segT(소수)
 *
 * 반환값: [wp[0] .. wp[segIndex]] + 보간된 현재 위치
 * progress ≈ 0 이면 waypoints 1개 → MapShell 이 length < 2 guard 로 선 미표시.
 */
function traveledWaypoints(
  waypoints: ReadonlyArray<TrailWaypoint>,
  progress: number
): ReadonlyArray<TrailWaypoint> {
  if (waypoints.length < 2) return waypoints;
  const clamped = Math.max(0, Math.min(1, progress));
  const totalSegs = waypoints.length - 1;
  const pos = clamped * totalSegs;
  const segIndex = Math.min(Math.floor(pos), totalSegs - 1);
  const segT = pos - segIndex;

  const traveled: TrailWaypoint[] = waypoints.slice(0, segIndex + 1) as TrailWaypoint[];

  // 세그먼트 중간 지점이면 보간 좌표를 끝점으로 추가
  if (segT > 0) {
    const from = waypoints[segIndex];
    const to = waypoints[segIndex + 1];
    traveled.push({
      lat: from.lat + (to.lat - from.lat) * segT,
      lng: from.lng + (to.lng - from.lng) * segT
    });
  }

  return traveled;
}

/**
 * 선택된 차량의 **현재까지 이동한** 경로 waypoints 반환.
 *
 * - IMEI=-1 시뮬 차량: OSRM routeWaypoints 를 progress 로 슬라이스.
 *   MOVING + routeWaypoints 있을 때만 반환. WORKING / fetch 중이면 null.
 * - 실제 차량: null (백엔드 API 완성 후 fetchBikeLocationHistory 로 교체).
 * - selectedBikeId === null → null.
 *
 * 250ms tick 마다 simulated 가 갱신 → 훅 재계산 → MapShell Polyline 자동 연장.
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
        sim.phase === "MOVING" &&
        sim.routeWaypoints !== null &&
        sim.routeWaypoints.length >= 2
      ) {
        return traveledWaypoints(sim.routeWaypoints, sim.progress);
      }
      return null;
    }

    // 실제 차량 — stub: 현재 null. fetchBikeLocationHistory 로 교체 예정.
    return null;
  }, [selectedBikeId, simulated]);
}
