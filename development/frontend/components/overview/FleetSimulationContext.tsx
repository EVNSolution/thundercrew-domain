"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  advanceBikeState,
  makeInitialState,
  isCleaningPurpose,
  TICK_INTERVAL_MS,
  MOVING_DURATION_MAX_MS,
  CLEANING_MOVING_DURATION_MAX_MS,
  type SimulatedBikeState,
  type ServicePhase
} from "@/lib/services/fleet-simulation";
import { useNotifications } from "@/components/layout/NotificationContext";
import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";
import {
  completeCurrentCleaningDispatchAction,
  recordReignitionNotificationAction
} from "@/app/dispatch/actions";
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
  /** bikeId → 마지막으로 출발(시동 ON)한 현재 배차의 복합키. 같은 건으론 재출발하지 않도록 한다. */
  const lastDepartedDispatchKeyRef = useRef<Map<string, string>>(new Map());
  /** bikeId → 직전 tick 의 phase. 클리닝 작업 종료(WORKING→IDLE) 전환 감지용. */
  const prevPhaseRef = useRef<Map<string, ServicePhase>>(new Map());

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

  // 자동 트리거: matchedImeiSet 이 변경되면 새로 매칭된 bike 를 시뮬레이션에 추가.
  // - DELIVERY/OTHER: 항상 MOVING 으로 시작. 차량별로 0~5분 랜덤 오프셋을 줘
  //   사이클이 분산되도록 한다 (마치 이미 서로 다른 시점에 출발한 것처럼).
  // - CLEANING: 현재 배차(currentDispatch) 좌표가 있으면 MOVING, 없으면 IDLE(대기 중)
  //   으로 시작. 좌표 없이 랜덤 좌표로 이동하는 것을 방지.
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
        // 청소형: 현재 배차(dispatch) 좌표가 있으면 그곳으로 출발, 없으면 IDLE 대기.
        const dispatchDestination =
          isCleaningPurpose(pin?.purpose) &&
          pin?.currentDispatchLatitude != null &&
          pin?.currentDispatchLongitude != null
            ? { lat: pin.currentDispatchLatitude, lng: pin.currentDispatchLongitude }
            : null;
        const initialPhase: "MOVING" | "IDLE" =
          isCleaningPurpose(pin?.purpose) && dispatchDestination === null
            ? "IDLE"
            : "MOVING";
        // MOVING 시작 시에만 오프셋으로 사이클 분산. WORKING 은 어차피 대기이므로 불필요.
        // 청소형은 최대 이동 시간이 5분이므로 그 범위 안에서만 오프셋을 줌.
        const maxOffsetMs = isCleaningPurpose(pin?.purpose) ? CLEANING_MOVING_DURATION_MAX_MS : MOVING_DURATION_MAX_MS;
        const offsetMs = initialPhase === "MOVING" ? Math.random() * maxOffsetMs : 0;
        next.set(
          bikeId,
          makeInitialState({
            bikeId,
            origin,
            nowMs: nowMs - offsetMs,
            phase: initialPhase,
            initialBatteryPercent:
              typeof pin?.batteryPercent === "number" ? pin.batteryPercent : 90,
            purpose: pin?.purpose ?? "DELIVERY",
            nextCustomerDestination: dispatchDestination
          })
        );
        mutated = true;
      }
      return mutated ? next : prev;
    });
  }, [matchedImeiSet]);

  // 시동 ON(WORKING→MOVING) 감지 — CLEANING 차량에 한해:
  //   1. 알림 발송 (현재 배차 고객명 + 주소)
  //   2. lastDepartedDispatchKeyRef 에 이번 출발한 현재 배차 키 기록 → tick 루프가
  //      같은 건으로 재출발(재트리거)하지 않도록 함. 운영자 "완료" → 다음 건이
  //      현재 배차가 되면 키가 바뀌어 다시 출발한다.
  useEffect(() => {
    for (const [bikeId, state] of simulated) {
      if (!isCleaningPurpose(state.purpose)) continue;
      if (state.ignitionOnAt == null) continue;
      const last = lastNotifiedIgnitionOnAtRef.current.get(bikeId);
      if (last === state.ignitionOnAt) continue;
      lastNotifiedIgnitionOnAtRef.current.set(bikeId, state.ignitionOnAt);
      const pin = pinsRef.current.find((p) => p.bikeId === bikeId);
      const plateNumber = pin?.plateNumber ?? bikeId.slice(0, 8);
      addNotification({
        plateNumber,
        startedAt: state.ignitionOnAt,
        customerName: pin?.currentDispatchCustomerName ?? undefined,
        address: pin?.currentDispatchAddress ?? undefined,
        // 클리닝 차량의 출발은 배차 kind 와 무관하게 "클리닝 출발" 로 —
        // 클린차량인데 "배송 출발" 로 뜨는 이질감을 없앤다.
        kind: "CLEANING",
      });
      void recordReignitionNotificationAction({
        bikeId,
        plateNumber,
        occurredAt: new Date(state.ignitionOnAt).toISOString(),
        nextCustomerName: pin?.currentDispatchCustomerName ?? null,
        nextAddress: pin?.currentDispatchAddress ?? null,
        nextLatitude: pin?.currentDispatchLatitude ?? null,
        nextLongitude: pin?.currentDispatchLongitude ?? null,
      });
      const key = dispatchKeyOf(pin);
      if (key) lastDepartedDispatchKeyRef.current.set(bikeId, key);
    }
    // 클리닝 작업 종료(WORKING 30초 → IDLE) 감지 — 이번에 다녀온 배차를
    // 서버에서 완료 처리한다. 완료되면 map-state 폴링이 다음 예약을 현재
    // 배차로 내려주고, 위 출발 가드의 키가 바뀌어 시뮬이 다음 배차지로
    // 출발한다 — 등록된 배차 체인을 순서대로 도는 클리닝 시나리오.
    // 전환은 tick 당 1회만 관측되므로 자연 dedup 이고, 다른 세션이 먼저
    // 완료했으면 액션이 조용히 실패한다.
    for (const [bikeId, state] of simulated) {
      const prevPhase = prevPhaseRef.current.get(bikeId);
      prevPhaseRef.current.set(bikeId, state.phase);
      if (!isCleaningPurpose(state.purpose)) continue;
      if (prevPhase === "WORKING" && state.phase === "IDLE") {
        void completeCurrentCleaningDispatchAction(bikeId);
      }
    }
    // 시뮬레이션에서 빠진 bike 의 ref 항목 정리 (알림 dedup + 출발 가드 + phase 세 Map).
    // Map 은 .keys() 순회 중 이미 방문한 키 삭제가 안전하다.
    for (const bikeId of lastNotifiedIgnitionOnAtRef.current.keys()) {
      if (!simulated.has(bikeId)) lastNotifiedIgnitionOnAtRef.current.delete(bikeId);
    }
    for (const bikeId of lastDepartedDispatchKeyRef.current.keys()) {
      if (!simulated.has(bikeId)) lastDepartedDispatchKeyRef.current.delete(bikeId);
    }
    for (const bikeId of prevPhaseRef.current.keys()) {
      if (!simulated.has(bikeId)) prevPhaseRef.current.delete(bikeId);
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

          // nextCustomerDestination 을 advanceBikeState 호출 전에 최신 pin 데이터로 동기화.
          // 순서가 중요: CLEANING 차량이 대기 중(phaseEndsAt=Infinity)일 때 목적지가 새로
          // 설정되면 advance 함수가 그 값을 보고 즉시 MOVING 으로 전환해야 하기 때문.
          const pin = pinsRef.current.find((p) => p.bikeId === bikeId);
          // 현재 배차 키가 이번 차량이 마지막으로 출발한 키와 같으면(이미 다녀옴)
          // 목적지를 주지 않아 도착 후 같은 건으로 재출발하지 않게 한다.
          const dKey = dispatchKeyOf(pin);
          const alreadyDeparted =
            dKey != null && lastDepartedDispatchKeyRef.current.get(bikeId) === dKey;
          const newDest =
            isCleaningPurpose(pin?.purpose) && dKey != null && !alreadyDeparted
              ? { lat: pin!.currentDispatchLatitude!, lng: pin!.currentDispatchLongitude! }
              : null;
          const prevDest = state.nextCustomerDestination;
          const destChanged =
            prevDest?.lat !== newDest?.lat || prevDest?.lng !== newDest?.lng;
          const stateForAdvance: SimulatedBikeState = destChanged
            ? { ...state, nextCustomerDestination: newDest }
            : state;

          const advanced = advanceBikeState(stateForAdvance, nowMs, isMatched);
          if (advanced !== stateForAdvance || destChanged) mutated = true;

          // 비매칭 + WORKING/IDLE + phaseEndsAt=Infinity → cleanup (다음 매칭까지 불필요)
          if (
            !isMatched &&
            (advanced.phase === "WORKING" || advanced.phase === "IDLE") &&
            advanced.phaseEndsAt === Number.POSITIVE_INFINITY
          ) {
            mutated = true;
            continue;
          }
          next.set(bikeId, advanced);
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
          // stale guard: bike 가 이미 WORKING/IDLE 로 돌아갔으면 주입 무시
          if (!current || current.phase === "WORKING" || current.phase === "IDLE") return prev;
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
 * 현재 배차의 신원 복합키. 좌표·고객명이 모두 없으면 null(배차 없음).
 * 한계: pin 에 주문 id 가 없어 좌표+고객명으로 식별한다 — 동일 좌표·동일 고객에게
 * 연속 배차되면 두 건이 같은 키가 되어 재출발 가드가 두 번째를 이미 다녀온 것으로
 * 오인할 수 있다. 실무상 CLEANING 배차점은 좌표로 구분되므로 데모 범위에선 허용.
 */
function dispatchKeyOf(pin: FrontendDashboardBikePin | undefined): string | null {
  if (!pin || pin.currentDispatchLatitude == null || pin.currentDispatchLongitude == null) return null;
  return `${pin.currentDispatchLatitude},${pin.currentDispatchLongitude},${pin.currentDispatchCustomerName ?? ""}`;
}

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
