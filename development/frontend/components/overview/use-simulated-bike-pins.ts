"use client";

import { useMemo } from "react";

import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";
import type { VehicleCurrentTelemetrySummary } from "@/lib/services/vehicle-maintenance-data";
import type { ServicePhase } from "@/lib/services/fleet-simulation";

/**
 * MapShell / OverviewMapSearch 에 전달하는 클라이언트 전용 확장 타입.
 * FrontendDashboardBikePin 위에 servicePhase / ignitionOnAt 을 overlay 한다.
 */
export type SimulatedBikePin = FrontendDashboardBikePin & {
  servicePhase: ServicePhase | null;
  /** 누적 완료 건수. 시뮬레이션 대상이 아니면 undefined. */
  deliveryCount?: number;
  /** WORKING→MOVING 전환 시점 ms. 말풍선 표시 여부 판단에 사용. null 이면 미표시. */
  ignitionOnAt?: number | null;
};

/**
 * 지도 마커용 — raw bikePins 배열 위에 fleet 시뮬레이션 상태를 overlay 한다.
 */
export function useSimulatedBikePins(
  rawPins: ReadonlyArray<FrontendDashboardBikePin>
): SimulatedBikePin[] {
  const { simulated } = useFleetSimulation();
  return useMemo(() => {
    if (simulated.size === 0) {
      return rawPins.map((pin) => ({ ...pin, servicePhase: null }));
    }
    const nowIso = new Date().toISOString();
    return rawPins.map((pin) => {
      const sim = simulated.get(pin.bikeId);
      if (!sim) return { ...pin, servicePhase: null };
      const batteryStatus: FrontendDashboardBikePin["batteryStatus"] =
        sim.batteryPercent < 20 ? "CRITICAL" : sim.batteryPercent <= 50 ? "LOW" : "NORMAL";
      const drivingStatus: FrontendDashboardBikePin["drivingStatus"] =
        sim.ignitionStatus === "ON" ? (sim.speedKph >= 3 ? "DRIVING" : "STOPPED") : "PARKED";
      return {
        ...pin,
        latitude: sim.position.lat,
        longitude: sim.position.lng,
        speedKph: sim.speedKph,
        batteryPercent: Math.round(sim.batteryPercent),
        ignitionStatus: sim.ignitionStatus,
        connectionStatus: "ONLINE",
        drivingStatus,
        batteryStatus,
        lastReceivedAt: nowIso,
        servicePhase: sim.phase,
        // 마커 배지의 "N건" — 실제 배차 큐(ASSIGNED 잔여)가 있으면 그 값을 우선.
        // dispatchQueueCount 가 0(배차 데이터 없음) 이면 기존 시뮬 누적 건수로 폴백해
        // 배차 데이터가 없는 차량의 시뮬레이션 동작을 그대로 유지한다.
        deliveryCount: pin.dispatchQueueCount > 0 ? pin.dispatchQueueCount : sim.deliveryCount,
        ignitionOnAt: sim.ignitionOnAt
      };
    });
  }, [rawPins, simulated]);
}

/**
 * 차량 상세 패널 텔레메트리 섹션용.
 */
export function useSimulatedCurrentTelemetry(
  rawCurrent: VehicleCurrentTelemetrySummary | null,
  bikeId: string | null
): VehicleCurrentTelemetrySummary | null {
  const { simulated } = useFleetSimulation();
  return useMemo(() => {
    if (!bikeId) return rawCurrent;
    const sim = simulated.get(bikeId);
    if (!sim) return rawCurrent;
    const batteryStatus: VehicleCurrentTelemetrySummary["batteryStatus"] =
      sim.batteryPercent < 20 ? "CRITICAL" : sim.batteryPercent <= 50 ? "LOW" : "NORMAL";
    const drivingStatus: VehicleCurrentTelemetrySummary["drivingStatus"] =
      sim.ignitionStatus === "ON" ? (sim.speedKph >= 3 ? "DRIVING" : "STOPPED") : "PARKED";
    return {
      odometerKm: Math.round(sim.odometerKm),
      connectionStatus: "ONLINE",
      ignitionStatus: sim.ignitionStatus,
      batteryPercent: Math.round(sim.batteryPercent),
      batteryStatus,
      speedKph: sim.speedKph,
      drivingStatus,
      lastReceivedAt: new Date().toISOString()
    };
  }, [rawCurrent, bikeId, simulated]);
}
