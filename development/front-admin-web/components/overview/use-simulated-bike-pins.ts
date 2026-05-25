"use client";

import { useMemo } from "react";

import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";
import type { VehicleCurrentTelemetrySummary } from "@/lib/services/vehicle-maintenance-data";
import type { DeliveryPhase } from "@/lib/services/fleet-simulation";

/**
 * MapShell / OverviewMapSearch 에 전달하는 클라이언트 전용 확장 타입.
 * FrontendDashboardBikePin 위에 deliveryPhase 를 overlay 한다.
 */
export type SimulatedBikePin = FrontendDashboardBikePin & {
  deliveryPhase: DeliveryPhase | null;
};

/**
 * 지도 마커용 — raw bikePins 배열 위에 fleet 시뮬레이션 상태를 overlay 한다.
 * simulated 가 비어 있으면 raw 가 그대로 반환되어 비용 없음. 시뮬레이트
 * 되는 차량의 lat/lng / 시동 / 속도 / 배터리 / 연결 상태 / 마지막 수신 만
 * 갈아끼우고 다른 필드 (plateNumber, modelName 등) 는 raw 그대로.
 */
export function useSimulatedBikePins(
  rawPins: ReadonlyArray<FrontendDashboardBikePin>
): SimulatedBikePin[] {
  const { simulated } = useFleetSimulation();
  return useMemo(() => {
    if (simulated.size === 0) {
      return rawPins.map((pin) => ({ ...pin, deliveryPhase: null }));
    }
    const nowIso = new Date().toISOString();
    return rawPins.map((pin) => {
      const sim = simulated.get(pin.bikeId);
      if (!sim) return { ...pin, deliveryPhase: null };
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
        deliveryPhase: sim.phase
      };
    });
  }, [rawPins, simulated]);
}

/**
 * 차량 상세 패널 텔레메트리 섹션용 — bundle.currentState 위에 simulated
 * overlay. raw 가 null 이고 simulated 에도 entry 없으면 null. simulated 가
 * 있으면 거기서 합성한 summary 를 돌려준다.
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
