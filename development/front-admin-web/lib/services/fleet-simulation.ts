/**
 * Fleet 서비스 시뮬레이션 순수 데이터 모델 + phase 진행 함수.
 *
 * Phase: WORKING(작업, 시동 OFF) ↔ MOVING(이동 중, 시동 ON)
 * isMatched=true 이면 WORKING → MOVING 자동 전환, false 이면 WORKING 유지.
 */

export type ServicePhase = "WORKING" | "MOVING";

export type ServiceType = "DELIVERY" | "CLEANING" | "OTHER";

export type SimulatedBikeState = {
  bikeId: string;
  phase: ServicePhase;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number } | null;
  /** MOVING 진행률 0..1. WORKING 에선 0. */
  progress: number;
  /** 누적 완료 건수. MOVING → WORKING 전환 시마다 +1. */
  deliveryCount: number;
  /** 현재 표시 위치 */
  position: { lat: number; lng: number };
  /** 이 phase 의 시작 ms */
  phaseStartedAt: number;
  /** 이 phase 의 종료 예정 ms */
  phaseEndsAt: number;
  /** 현재 표시 속도 km/h */
  speedKph: number;
  /** 현재 시동. MOVING 만 ON. */
  ignitionStatus: "ON" | "OFF";
  /**
   * WORKING→MOVING 전환 시점 ms. 말풍선 표시 여부 판단에 사용.
   * MOVING→WORKING 전환 시 null 로 초기화.
   */
  ignitionOnAt: number | null;
  /** 서비스 유형. "CLEANING" 이면 알림 + 말풍선 활성. */
  serviceType: ServiceType;
  /** 누적 km */
  odometerKm: number;
  /** 배터리 % */
  batteryPercent: number;
  /** OSRM 경로 waypoints */
  routeWaypoints: ReadonlyArray<{ lat: number; lng: number }> | null;
  /** CLEANING 전용. 관리자가 설정한 다음 고객 좌표. null 이면 randomSeoulPoint() 사용. */
  nextCustomerDestination: { lat: number; lng: number } | null;
};

/** tick 간격 (ms) */
export const TICK_INTERVAL_MS = 250;
/** MOVING 한 주기 최소 길이 — DELIVERY/OTHER (15분) */
export const MOVING_DURATION_MIN_MS = 15 * 60 * 1_000;
/** MOVING 한 주기 최대 길이 — DELIVERY/OTHER (40분) */
export const MOVING_DURATION_MAX_MS = 40 * 60 * 1_000;
/** CLEANING 차량 MOVING 최소 길이 (2분) */
export const CLEANING_MOVING_DURATION_MIN_MS = 2 * 60 * 1_000;
/** CLEANING 차량 MOVING 최대 길이 (5분) */
export const CLEANING_MOVING_DURATION_MAX_MS = 5 * 60 * 1_000;
/** 완료 후 다음 사이클까지 최소 대기 (ms) */
export const WORKING_BETWEEN_MIN_MS = 5_000;
/** 완료 후 다음 사이클까지 최대 대기 (ms) */
export const WORKING_BETWEEN_MAX_MS = 30_000;
/** MOVING 시 표시 속도 (km/h) */
export const MOVING_SPEED_KPH = 30;
/** 초당 배터리 감소량 */
export const BATTERY_DROP_PER_SECOND = 0.05;

const SEOUL_LAT_MIN = 37.44;
const SEOUL_LAT_MAX = 37.65;
const SEOUL_LNG_MIN = 126.87;
const SEOUL_LNG_MAX = 127.10;

function randomMovingDurationMs(random: () => number, serviceType: ServiceType = "DELIVERY"): number {
  if (serviceType === "CLEANING") {
    return CLEANING_MOVING_DURATION_MIN_MS + random() * (CLEANING_MOVING_DURATION_MAX_MS - CLEANING_MOVING_DURATION_MIN_MS);
  }
  return MOVING_DURATION_MIN_MS + random() * (MOVING_DURATION_MAX_MS - MOVING_DURATION_MIN_MS);
}

function randomSeoulPoint(random: () => number = Math.random): { lat: number; lng: number } {
  return {
    lat: SEOUL_LAT_MIN + random() * (SEOUL_LAT_MAX - SEOUL_LAT_MIN),
    lng: SEOUL_LNG_MIN + random() * (SEOUL_LNG_MAX - SEOUL_LNG_MIN)
  };
}

function approxDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 88;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function lerpPosition(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  t: number
): { lat: number; lng: number } {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    lat: from.lat + (to.lat - from.lat) * clamped,
    lng: from.lng + (to.lng - from.lng) * clamped
  };
}

function walkPolyline(
  waypoints: ReadonlyArray<{ lat: number; lng: number }>,
  t: number
): { lat: number; lng: number } {
  if (waypoints.length === 0) return { lat: 37.5665, lng: 126.978 };
  if (waypoints.length === 1) return waypoints[0];
  const clamped = Math.max(0, Math.min(1, t));
  const totalSegs = waypoints.length - 1;
  const pos = clamped * totalSegs;
  const segIndex = Math.min(Math.floor(pos), totalSegs - 1);
  const segT = pos - segIndex;
  return lerpPosition(waypoints[segIndex], waypoints[segIndex + 1], segT);
}

export function advanceBikeState(
  prev: SimulatedBikeState,
  nowMs: number,
  isMatched: boolean,
  random: () => number = Math.random
): SimulatedBikeState {
  // CLEANING: WORKING 무한 대기 중 nextCustomerDestination 이 설정되면 즉시 MOVING 전환.
  // phaseEndsAt 체크보다 먼저 실행해야 Infinity 대기 상태도 처리됨.
  if (
    prev.phase === "WORKING" &&
    isMatched &&
    prev.serviceType === "CLEANING" &&
    prev.nextCustomerDestination !== null
  ) {
    return {
      ...prev,
      phase: "MOVING",
      destination: prev.nextCustomerDestination,
      progress: 0,
      position: prev.origin,
      phaseStartedAt: nowMs,
      phaseEndsAt: nowMs + randomMovingDurationMs(random, prev.serviceType),
      speedKph: MOVING_SPEED_KPH,
      ignitionStatus: "ON",
      ignitionOnAt: nowMs,
      routeWaypoints: null
    };
  }

  if (nowMs < prev.phaseEndsAt) {
    if (prev.phase !== "MOVING" || !prev.destination) return prev;
    const total = prev.phaseEndsAt - prev.phaseStartedAt;
    const elapsed = nowMs - prev.phaseStartedAt;
    const progress = total > 0 ? elapsed / total : 1;
    const position = prev.routeWaypoints
      ? walkPolyline(prev.routeWaypoints, progress)
      : lerpPosition(prev.origin, prev.destination, progress);
    const distanceKm = approxDistanceKm(prev.origin, prev.destination);
    const totalSeconds = total / 1_000;
    const tickFactor = TICK_INTERVAL_MS / 1_000;
    const odometerDelta = totalSeconds > 0 ? (distanceKm / totalSeconds) * tickFactor : 0;
    const batteryDelta = BATTERY_DROP_PER_SECOND * tickFactor;
    return {
      ...prev,
      progress,
      position,
      odometerKm: prev.odometerKm + odometerDelta,
      batteryPercent: Math.max(0, prev.batteryPercent - batteryDelta)
    };
  }

  switch (prev.phase) {
    case "WORKING": {
      if (!isMatched) {
        return { ...prev, phaseEndsAt: Number.POSITIVE_INFINITY };
      }
      // CLEANING 차량은 위의 조기 전환 로직에서 nextCustomerDestination !== null 케이스를 처리함.
      // 여기까지 오면 nextCustomerDestination === null → 계속 대기.
      if (prev.serviceType === "CLEANING") {
        return { ...prev, phaseEndsAt: Number.POSITIVE_INFINITY };
      }
      // DELIVERY / OTHER: 랜덤 목적지로 이동 시작
      const destination = randomSeoulPoint(random);
      return {
        ...prev,
        phase: "MOVING",
        destination,
        progress: 0,
        position: prev.origin,
        phaseStartedAt: nowMs,
        phaseEndsAt: nowMs + randomMovingDurationMs(random, prev.serviceType),
        speedKph: MOVING_SPEED_KPH,
        ignitionStatus: "ON",
        ignitionOnAt: nowMs,
        routeWaypoints: null
      };
    }
    case "MOVING": {
      const finalPosition = prev.destination ?? prev.origin;
      // CLEANING 차량은 다음 고객 목적지가 입력될 때까지 WORKING 상태를 유지해야 하므로
      // phaseEndsAt 을 Infinity 로 설정해 타이머 없이 대기.
      const idleMs =
        !isMatched || prev.serviceType === "CLEANING"
          ? Number.POSITIVE_INFINITY
          : WORKING_BETWEEN_MIN_MS +
            Math.floor(random() * (WORKING_BETWEEN_MAX_MS - WORKING_BETWEEN_MIN_MS));
      const workingPhaseEndsAt = idleMs === Number.POSITIVE_INFINITY ? idleMs : nowMs + idleMs;
      return {
        ...prev,
        phase: "WORKING",
        progress: 0,
        position: finalPosition,
        origin: finalPosition,
        destination: null,
        // CLEANING: 도착 즉시 초기화 — pinsRef 정리 전 다음 tick 이 재트리거하지 않도록.
        nextCustomerDestination: null,
        phaseStartedAt: nowMs,
        phaseEndsAt: workingPhaseEndsAt,
        speedKph: 0,
        ignitionStatus: "OFF",
        ignitionOnAt: null,
        routeWaypoints: null,
        deliveryCount: prev.deliveryCount + 1
      };
    }
  }
}

export function makeInitialState(input: {
  bikeId: string;
  origin: { lat: number; lng: number };
  nowMs: number;
  phase: "WORKING" | "MOVING";
  random?: () => number;
  initialOdometerKm?: number;
  initialBatteryPercent?: number;
  serviceType?: ServiceType;
  nextCustomerDestination?: { lat: number; lng: number } | null;
}): SimulatedBikeState {
  const {
    bikeId,
    origin,
    nowMs,
    phase,
    random = Math.random,
    initialOdometerKm = 0,
    initialBatteryPercent = 90,
    serviceType = "DELIVERY",
    nextCustomerDestination = null
  } = input;

  if (phase === "MOVING") {
    return {
      bikeId,
      phase: "MOVING",
      origin,
      destination: nextCustomerDestination ?? randomSeoulPoint(random),
      progress: 0,
      position: origin,
      phaseStartedAt: nowMs,
      phaseEndsAt: nowMs + randomMovingDurationMs(random, serviceType),
      speedKph: MOVING_SPEED_KPH,
      ignitionStatus: "ON",
      ignitionOnAt: nowMs,
      odometerKm: initialOdometerKm,
      batteryPercent: initialBatteryPercent,
      routeWaypoints: null,
      deliveryCount: 0,
      serviceType,
      nextCustomerDestination: nextCustomerDestination ?? null
    };
  }

  return {
    bikeId,
    phase: "WORKING",
    origin,
    destination: null,
    progress: 0,
    position: origin,
    phaseStartedAt: nowMs,
    phaseEndsAt: Number.POSITIVE_INFINITY,
    speedKph: 0,
    ignitionStatus: "OFF",
    ignitionOnAt: null,
    odometerKm: initialOdometerKm,
    batteryPercent: initialBatteryPercent,
    routeWaypoints: null,
    deliveryCount: 0,
    serviceType,
    nextCustomerDestination: nextCustomerDestination ?? null
  };
}
