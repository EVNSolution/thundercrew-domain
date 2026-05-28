"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  advanceBikeState,
  makeInitialState,
  TICK_INTERVAL_MS,
  MOVING_DURATION_MAX_MS,
  type SimulatedBikeState,
  type ServicePhase
} from "@/lib/services/fleet-simulation";
import { useNotifications } from "@/components/layout/NotificationContext";
import { clearNextCustomerAction } from "@/app/actions";
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";
import { fetchOsrmRoute } from "@/lib/services/osrm";

/**
 * IMEI=-1 자동 배송 시뮬레이션 — 라이더-차량 매칭을 감지해 자동으로 시작/중단.
 *
 * Provider 는 두 직렬화된 배열 prop 을 받는다:
 *   - imeiMinusOneBikeIds: deviceUid="-1" 인 bikeId 목록 (SSR에서 계산)
 *   - bikeRiderPairs: 현재 활성 매칭 [bikeId, riderId][] (SSR에서 계산)
 *
 * 교집합(imeiMinusOneBikeIds ∩ 매칭된 bikeId)이 변경되면 자동으로 시뮬레이션
 * entry 를 추가/제거한다. 250ms tick 으로 이동이 부드럽게.
 */

type FleetSimulationContextValue = {
  /** bikeId → 시뮬레이트된 상태. 매칭된 IMEI=-1 bike 만 포함. */
  simulated: ReadonlyMap<string, SimulatedBikeState>;
  /** OverviewMapBanner / FullscreenMapHost 가 호출 — origin 좌표 조회용. */
  seedBikePins: (pins: ReadonlyArray<FrontendDashboardBikePin>) => void;
};

const FleetSimulationContext = createContext<FleetSimulationContextValue | null>(null);

type FleetSimulationProviderProps = {
  /** deviceUid="-1" 인 bikeId 배열. RSC→client 직렬화를 위해 배열로. */
  imeiMinusOneBikeIds: string[];
  /** 활성 라이더-차량 매칭 쌍 배열. RSC→client 직렬화를 위해 배열로. */
  bikeRiderPairs: [string, string][];
  children: ReactNode;
};

export function FleetSimulationProvider({
  imeiMinusOneBikeIds,
  bikeRiderPairs,
  children
}: FleetSimulationProviderProps) {
  const [simulated, setSimulated] = useState<ReadonlyMap<string, SimulatedBikeState>>(() => new Map());
  const pinsRef = useRef<ReadonlyArray<FrontendDashboardBikePin>>([]);
  const pendingFetchesRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const { addNotification } = useNotifications();
  /** bikeId → last ignitionOnAt that was notified. Prevents duplicate notifications. */
  const lastNotifiedIgnitionOnAtRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const seedBikePins = useCallback((pins: ReadonlyArray<FrontendDashboardBikePin>) => {
    pinsRef.current = pins;
  }, []);

  // 직렬화된 배열 → Set/Map (useMemo 로 참조 안정화).
  // dep 에 함수 호출식 대신 단순 변수를 사용해야 react-hooks/use-memo 규칙 통과.
  const imeiMinusOneKey = imeiMinusOneBikeIds.join(",");
  const imeiMinusOneSet = useMemo(
    () => new Set(imeiMinusOneBikeIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imeiMinusOneKey]
  );

  // 매칭된 IMEI=-1 bikeId Set — 이 set 이 변경될 때 자동 트리거 발동.
  const bikeRiderKey = bikeRiderPairs.map(([b]) => b).join(",");
  const matchedImeiSet = useMemo(() => {
    const s = new Set<string>();
    for (const [bikeId] of bikeRiderPairs) {
      if (imeiMinusOneSet.has(bikeId)) s.add(bikeId);
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bikeRiderKey, imeiMinusOneSet]);

  // Ref — tick loop 의 stale closure 방지. useLayoutEffect 로 render 밖에서 갱신.
  const matchedImeiSetRef = useRef(matchedImeiSet);
  useLayoutEffect(() => {
    matchedImeiSetRef.current = matchedImeiSet;
  });

  // 자동 트리거: matchedImeiSet 이 변경되면 새로 매칭된 bike 를 MOVING 으로 시작.
  // 여러 차량이 동시에 초기화될 때 모두 같은 nowMs 를 쓰면 5분 후 동시에 사이클이
  // 끝나 "대기" 가 동시에 표시된다. 차량별로 0~5분 랜덤 오프셋을 주어 사이클을
  // 처음부터 분산시킨다 — 마치 이미 서로 다른 시점에 출발한 것처럼 보임.
  useEffect(() => {
    const nowMs = Date.now();
    setSimulated((prev) => {
      let mutated = false;
      const next = new Map(prev);
      for (const bikeId of matchedImeiSet) {
        if (next.has(bikeId)) continue; // 이미 시뮬레이션 중 — 중복 방지
        const pin = pinsRef.current.find((p) => p.bikeId === bikeId);
        const origin = pin
          ? { lat: pin.latitude, lng: pin.longitude }
          : { lat: 37.5665, lng: 126.978 }; // 서울 중심 fallback
        // 차량마다 0~5분 사이 랜덤 진행률로 시작 — phaseStartedAt 을 과거로 당겨
        // advanceBikeState 가 첫 tick 에 올바른 progress / position 을 계산.
        const offsetMs = Math.random() * MOVING_DURATION_MAX_MS;
        next.set(
          bikeId,
          makeInitialState({
            bikeId,
            origin,
            nowMs: nowMs - offsetMs,
            phase: "MOVING",
            initialBatteryPercent:
              typeof pin?.batteryPercent === "number" ? pin.batteryPercent : 90,
            serviceType: pin?.serviceType ?? "DELIVERY",
            nextCustomerDestination:
              (pin?.serviceType === "CLEANING" &&
               pin.nextCustomerLat != null &&
               pin.nextCustomerLng != null)
                ? { lat: pin.nextCustomerLat, lng: pin.nextCustomerLng }
                : null
          })
        );
        mutated = true;
      }
      return mutated ? next : prev;
    });
  }, [matchedImeiSet]);

  // Detect WORKING→MOVING transitions → send ignition notification.
  useEffect(() => {
    for (const [bikeId, state] of simulated) {
      if (state.ignitionOnAt == null) continue;
      const last = lastNotifiedIgnitionOnAtRef.current.get(bikeId);
      if (last === state.ignitionOnAt) continue;
      // 클리닝 차량에만 알림 발송
      if (state.serviceType !== "CLEANING") continue;
      lastNotifiedIgnitionOnAtRef.current.set(bikeId, state.ignitionOnAt);
      const pin = pinsRef.current.find((p) => p.bikeId === bikeId);
      const plateNumber = pin?.plateNumber ?? bikeId.slice(0, 8);
      addNotification({
        plateNumber,
        startedAt: state.ignitionOnAt,
        customerName: pin?.nextCustomerName ?? undefined,
        customerPhone: pin?.nextCustomerPhone ?? undefined
      });
      // 작업 완료 후 다음 고객 정보를 DB에서 제거 (fire-and-forget)
      clearNextCustomerAction(bikeId).catch(() => undefined);
      // pinsRef에서도 즉시 제거해 다음 MOVING 페이즈가 랜덤 좌표를 쓰도록
      pinsRef.current = pinsRef.current.map((p) =>
        p.bikeId === bikeId
          ? { ...p, nextCustomerLat: null, nextCustomerLng: null,
                nextCustomerName: null, nextCustomerPhone: null }
          : p
      );
    }
    // Clean up ref entries for bikes that left simulation
    for (const bikeId of lastNotifiedIgnitionOnAtRef.current.keys()) {
      if (!simulated.has(bikeId)) {
        lastNotifiedIgnitionOnAtRef.current.delete(bikeId);
      }
    }
  }, [simulated, addNotification]);

  // 250ms tick loop — mount 시 한 번만 interval 을 생성. simulated.size 를
  // dep 으로 두면 size 변화 시점에 효과가 재실행되면서 stale closure 가 발생해
  // "size === 0" 분기를 타는 경우가 있다. updater 패턴(prev) 으로 최신 상태를
  // 항상 받으므로 closure 문제 없이 deps=[] 로 고정한다.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const nowMs = Date.now();
      const currentMatched = matchedImeiSetRef.current;
      setSimulated((prev) => {
        if (prev.size === 0) return prev; // entry 없으면 no-op (re-render 없음)
        let mutated = false;
        const next = new Map<string, SimulatedBikeState>();
        for (const [bikeId, state] of prev) {
          const isMatched = currentMatched.has(bikeId);
          const advanced = advanceBikeState(state, nowMs, isMatched);
          if (advanced !== state) mutated = true;
          // 비매칭 + WORKING + phaseEndsAt=Infinity → cleanup (다음 매칭까지 불필요)
          if (
            !isMatched &&
            advanced.phase === "WORKING" &&
            advanced.phaseEndsAt === Number.POSITIVE_INFINITY
          ) {
            mutated = true;
            continue;
          }
          // Sync nextCustomerDestination from latest pin data (every 250ms)
          const pin = pinsRef.current.find((p) => p.bikeId === bikeId);
          const newDest =
            pin?.serviceType === "CLEANING" &&
            pin.nextCustomerLat != null &&
            pin.nextCustomerLng != null
              ? { lat: pin.nextCustomerLat, lng: pin.nextCustomerLng }
              : null;
          const prevDest = advanced.nextCustomerDestination;
          const destUnchanged =
            prevDest?.lat === newDest?.lat && prevDest?.lng === newDest?.lng;
          const entry: SimulatedBikeState = destUnchanged
            ? advanced
            : { ...advanced, nextCustomerDestination: newDest };
          if (!destUnchanged) mutated = true;
          next.set(bikeId, entry);
        }
        return mutated ? next : prev;
      });
    }, TICK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  // MOVING + routeWaypoints 없음 → OSRM 경로 fetch.
  // (즉시 이동 시작, 경로 도착 후 반영)
  useEffect(() => {
    for (const [bikeId, state] of simulated) {
      if (
        state.phase !== "MOVING" ||
        state.routeWaypoints !== null ||
        pendingFetchesRef.current.has(bikeId)
      ) {
        continue;
      }
      if (!state.destination) continue;

      pendingFetchesRef.current.add(bikeId);
      fetchOsrmRoute(state.origin, state.destination).then((waypoints) => {
        pendingFetchesRef.current.delete(bikeId);
        if (!mountedRef.current) return;
        if (waypoints.length === 0) return;
        setSimulated((prev) => {
          const current = prev.get(bikeId);
          // stale guard: bike 가 이미 WORKING 으로 돌아갔으면 주입 무시
          if (!current || current.phase === "WORKING") return prev;
          const next = new Map(prev);
          next.set(bikeId, { ...current, routeWaypoints: waypoints });
          return next;
        });
      });
    }
  }, [simulated]);

  const value = useMemo<FleetSimulationContextValue>(
    () => ({ simulated, seedBikePins }),
    [simulated, seedBikePins]
  );

  return <FleetSimulationContext.Provider value={value}>{children}</FleetSimulationContext.Provider>;
}

// 모듈 스코프 상수 — fallback 에서 호출마다 새 참조를 만들지 않도록.
const EMPTY_SIMULATED: ReadonlyMap<string, SimulatedBikeState> = new Map();
const NOOP_SEED = () => {};

/**
 * Provider 없는 환경에서도 안전하게 호출되도록 noop fallback 반환.
 */
export function useFleetSimulation(): FleetSimulationContextValue {
  const ctx = useContext(FleetSimulationContext);
  if (!ctx) {
    return { simulated: EMPTY_SIMULATED, seedBikePins: NOOP_SEED };
  }
  return ctx;
}
