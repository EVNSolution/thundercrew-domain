"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  advanceBikeState,
  makeInitialState,
  type SimulatedBikeState
} from "@/lib/services/fleet-simulation";
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";
import { generateVirtualFleet, type VirtualFleet } from "@/lib/services/virtual-fleet";
import { fetchOsrmRoute } from "@/lib/services/osrm";

/**
 * Fleet 배송 시뮬레이션 — 모든 클라이언트 트리가 공유하는 in-memory 시뮬레이터.
 * 1초 tick interval 안에서 모든 `simulated` entry 를 `advanceBikeState` 로
 * 진행시킨다. fleetRunning 이 false 이고 manual entry 도 없으면 interval 을
 * 멈춰 백그라운드 비용을 0 으로.
 */

const TICK_INTERVAL_MS = 1_000;

type FleetSimulationContextValue = {
  fleetRunning: boolean;
  setFleetRunning: (running: boolean) => void;
  /** bikeId → 시뮬레이트된 상태. fleet OFF 이고 manual 없으면 빈 Map. */
  simulated: ReadonlyMap<string, SimulatedBikeState>;
  /** 운영자가 단일 차량을 수동 배정. 이미 시뮬레이트 중이면 no-op. */
  assignSingleBike: (bikeId: string) => void;
  /** 단일 차량 배정을 운영자가 취소. EN_ROUTE 중이면 그대로 두고 IDLE 도달 시
   *  manual flag 가 false 가 되어 다음 사이클에 멈춘다. (즉시 제거하면 도중에
   *  지도 마커가 휙 텔레포트하는 부작용이 있어 사이클 종료까지 대기.) */
  cancelSingleBike: (bikeId: string) => void;
  /** OverviewMapBanner / FullscreenMapHost 가 호출 — 현재 dummy bikePins 를
   *  ref 에 저장해 두면 phase 전환 시 origin / 초기 odo / battery 를 거기서
   *  읽어 채울 수 있다. */
  seedBikePins: (pins: ReadonlyArray<FrontendDashboardBikePin>) => void;
  /** fleet 이 켜져 있는 동안에만 채워지는 가상 fleet 스냅샷. fleet OFF →
   *  null. setFleetRunning(true) 가 한 번 generate 해서 stop 전까지
   *  identity 유지 — consumers 의 useMemo 가 매 tick 재발화하지 않도록. */
  virtualFleet: VirtualFleet | null;
};

const FleetSimulationContext = createContext<FleetSimulationContextValue | null>(null);

export function FleetSimulationProvider({ children }: { children: ReactNode }) {
  const [fleetRunning, setFleetRaw] = useState(false);
  const [simulated, setSimulated] = useState<ReadonlyMap<string, SimulatedBikeState>>(() => new Map());
  const [virtualFleet, setVirtualFleet] = useState<VirtualFleet | null>(null);
  const pinsRef = useRef<ReadonlyArray<FrontendDashboardBikePin>>([]);
  /**
   * OSRM fetch 중인 bikeId Set. 동일 bike 에 중복 fetch 방지.
   * ref 라 React 렌더를 트리거하지 않음.
   */
  const pendingFetchesRef = useRef<Set<string>>(new Set());

  const seedBikePins = useCallback((pins: ReadonlyArray<FrontendDashboardBikePin>) => {
    pinsRef.current = pins;
  }, []);

  // fleet on 시 모든 등록된 bike 에 대해 IDLE staggered entry 를 seed.
  // 기존에 있던 manual entry 는 보존 (덮어쓰지 않음).
  const setFleetRunning = useCallback((running: boolean) => {
    if (running) {
      const nowMs = Date.now();
      const virtual = generateVirtualFleet({});
      setVirtualFleet(virtual);
      setSimulated((prev) => {
        const next = new Map(prev);
        const seedPins = [...pinsRef.current, ...virtual.bikePins];
        for (const pin of seedPins) {
          if (next.has(pin.bikeId)) continue;
          next.set(
            pin.bikeId,
            makeInitialState({
              bikeId: pin.bikeId,
              origin: { lat: pin.latitude, lng: pin.longitude },
              nowMs,
              phase: "IDLE",
              manualOrigin: false,
              initialOdometerKm: 0,
              initialBatteryPercent: typeof pin.batteryPercent === "number" ? pin.batteryPercent : 90
            })
          );
        }
        return next;
      });
    } else {
      // fleet 정지 — virtualFleet 즉시 비우면 다음 render 에서 mergedRawPins 가
      // 줄어들고 마커가 줄어든다. 시뮬레이션 entry 들은 기존 tick cleanup
      // 로직 (IDLE && !manualOrigin) 이 다음 IDLE 도달 시 자연스럽게 제거.
      setVirtualFleet(null);
    }
    setFleetRaw(running);
  }, []);

  const assignSingleBike = useCallback((bikeId: string) => {
    const pin = pinsRef.current.find((p) => p.bikeId === bikeId);
    if (!pin) return;
    setSimulated((prev) => {
      if (prev.has(bikeId)) return prev;
      const next = new Map(prev);
      next.set(
        bikeId,
        makeInitialState({
          bikeId,
          origin: { lat: pin.latitude, lng: pin.longitude },
          nowMs: Date.now(),
          phase: "ASSIGNED",
          manualOrigin: true,
          initialOdometerKm: 0,
          initialBatteryPercent: typeof pin.batteryPercent === "number" ? pin.batteryPercent : 90
        })
      );
      return next;
    });
  }, []);

  const cancelSingleBike = useCallback((bikeId: string) => {
    setSimulated((prev) => {
      const existing = prev.get(bikeId);
      if (!existing || !existing.manualOrigin) return prev;
      const next = new Map(prev);
      // 즉시 제거 — 운영자가 명시적 취소를 누른 거라 마커가 텔레포트해도 의도된 동작.
      next.delete(bikeId);
      return next;
    });
  }, []);

  // Tick 루프 — fleet 이 켜져 있거나 manual entry 가 하나라도 있으면 1초마다
  // 모든 entry 를 advanceBikeState 로 진행.
  useEffect(() => {
    if (!fleetRunning && simulated.size === 0) return;
    const interval = window.setInterval(() => {
      const nowMs = Date.now();
      setSimulated((prev) => {
        let mutated = false;
        const next = new Map<string, SimulatedBikeState>();
        for (const [bikeId, state] of prev) {
          const advanced = advanceBikeState(state, nowMs, fleetRunning);
          if (advanced !== state) mutated = true;
          // fleet 꺼진 후 IDLE 이고 manual 도 아니면 cleanup — 다음 fleet on 까지
          // simulated 에 머무를 이유 없음.
          if (!fleetRunning && advanced.phase === "IDLE" && !advanced.manualOrigin) {
            mutated = true;
            continue;
          }
          next.set(bikeId, advanced);
        }
        return mutated ? next : prev;
      });
    }, TICK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [fleetRunning, simulated.size]);

  // ASSIGNED 상태이면서 routeWaypoints 가 아직 없는 bike 를 발견하면
  // OSRM 경로를 fetch 해서 state 에 주입. pendingFetchesRef 로 중복 방지.
  useEffect(() => {
    for (const [bikeId, state] of simulated) {
      if (
        state.phase !== "ASSIGNED" ||
        state.routeWaypoints !== null ||
        pendingFetchesRef.current.has(bikeId)
      ) {
        continue;
      }
      if (!state.destination) continue; // ASSIGNED 에서 destination 은 항상 있지만 타입 guard

      pendingFetchesRef.current.add(bikeId);
      fetchOsrmRoute(state.origin, state.destination).then((waypoints) => {
        pendingFetchesRef.current.delete(bikeId);
        if (waypoints.length === 0) return; // 빈 배열 = 실패 → null 유지, 직선 fallback
        setSimulated((prev) => {
          const current = prev.get(bikeId);
          // stale guard: bike 가 이미 IDLE 로 돌아갔으면 주입 무시
          if (!current || current.phase === "IDLE") return prev;
          const next = new Map(prev);
          next.set(bikeId, { ...current, routeWaypoints: waypoints });
          return next;
        });
      });
    }
  }, [simulated]);

  const value = useMemo<FleetSimulationContextValue>(
    () => ({ fleetRunning, setFleetRunning, simulated, assignSingleBike, cancelSingleBike, seedBikePins, virtualFleet }),
    [fleetRunning, setFleetRunning, simulated, assignSingleBike, cancelSingleBike, seedBikePins, virtualFleet]
  );

  return <FleetSimulationContext.Provider value={value}>{children}</FleetSimulationContext.Provider>;
}

/**
 * provider 없는 환경에서도 안전하게 호출되도록 noop fallback 반환.
 */
export function useFleetSimulation(): FleetSimulationContextValue {
  const ctx = useContext(FleetSimulationContext);
  if (!ctx) {
    const emptyMap: ReadonlyMap<string, SimulatedBikeState> = new Map();
    return {
      fleetRunning: false,
      setFleetRunning: () => {},
      simulated: emptyMap,
      assignSingleBike: () => {},
      cancelSingleBike: () => {},
      seedBikePins: () => {},
      virtualFleet: null
    };
  }
  return ctx;
}
