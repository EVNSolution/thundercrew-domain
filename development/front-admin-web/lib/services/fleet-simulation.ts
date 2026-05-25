/**
 * Fleet 배송 시뮬레이션의 순수 데이터 모델 + phase 진행 함수.
 *
 * Provider 가 250ms tick interval 안에서 모든 `simulated` entry 를
 * `advanceBikeState` 로 진행시킨다. React / DOM / window 접근 없음.
 *
 * Phase: IDLE(대기) ↔ EN_ROUTE(배송 중) 2개만. ASSIGNED / ARRIVED 없음.
 * isMatched=true 이면 IDLE → EN_ROUTE 자동 전환, false 이면 IDLE 유지.
 */

export type DeliveryPhase = "IDLE" | "EN_ROUTE";

export type SimulatedBikeState = {
  bikeId: string;
  phase: DeliveryPhase;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number } | null;
  /** EN_ROUTE 진행률 0..1. IDLE 에선 0. */
  progress: number;
  /** 현재 표시 위치 — origin → destination 보간 결과 또는 phase 별 고정. */
  position: { lat: number; lng: number };
  /** 이 phase 의 시작 ms */
  phaseStartedAt: number;
  /**
   * 이 phase 의 종료 예정 ms.
   * IDLE + 비매칭이면 Number.POSITIVE_INFINITY (cleanup trigger).
   */
  phaseEndsAt: number;
  /** 현재 표시 속도 km/h */
  speedKph: number;
  /** 현재 시동. EN_ROUTE 만 ON. */
  ignitionStatus: "ON" | "OFF";
  /** 누적 km. EN_ROUTE 중 점진 증가. */
  odometerKm: number;
  /** 배터리 %. EN_ROUTE 중 감소. */
  batteryPercent: number;
  /**
   * OSRM 경로 waypoints. EN_ROUTE 진입 시 비동기 fetch, 도착 전까지
   * null → 직선 lerp fallback.
   */
  routeWaypoints: ReadonlyArray<{ lat: number; lng: number }> | null;
};

/** tick 간격 (ms). 250ms = 초당 4회 업데이트. */
export const TICK_INTERVAL_MS = 250;
/** 배송 한 주기 길이 (5분). */
export const EN_ROUTE_DURATION_MS = 5 * 60 * 1_000;
/** 배송 완료 후 다음 사이클까지 최소 대기 (ms). */
export const IDLE_BETWEEN_DELIVERIES_MIN_MS = 5_000;
/** 배송 완료 후 다음 사이클까지 최대 대기 (ms). */
export const IDLE_BETWEEN_DELIVERIES_MAX_MS = 30_000;
/** EN_ROUTE 시 표시 속도 (km/h). */
export const EN_ROUTE_SPEED_KPH = 30;
/** 초당 배터리 감소량. tick delta = 이 값 × (TICK_INTERVAL_MS / 1000). */
export const BATTERY_DROP_PER_SECOND = 0.05;

const SEOUL_LAT_MIN = 37.44;
const SEOUL_LAT_MAX = 37.65;
const SEOUL_LNG_MIN = 126.87;
const SEOUL_LNG_MAX = 127.10;

/**
 * 서울 박스 안 random 좌표. EN_ROUTE 의 destination 으로 사용.
 */
export function randomSeoulPoint(random: () => number = Math.random): { lat: number; lng: number } {
  return {
    lat: SEOUL_LAT_MIN + random() * (SEOUL_LAT_MAX - SEOUL_LAT_MIN),
    lng: SEOUL_LNG_MIN + random() * (SEOUL_LNG_MAX - SEOUL_LNG_MIN)
  };
}

/** Haversine 대신 단순 평면 근사 — 데모 표시용, km 단위 오차 무방. */
export function approxDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 88;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** lerp 보간 — t=0..1, from → to. clamp 포함. */
export function lerpPosition(
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

/**
 * progress t (0..1) 로 polyline 위 좌표 계산.
 * N 개 waypoint → N-1 세그먼트를 시간 균등 분배.
 */
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

/**
 * 250ms tick 마다 호출되어 prev 의 phase / position / 부속 값을 advance.
 *
 * `isMatched`: 이 bike 에 현재 라이더가 매칭되어 있는지.
 *   - IDLE + isMatched + phaseEndsAt 도달 → EN_ROUTE 전환
 *   - IDLE + !isMatched + phaseEndsAt 도달 → phaseEndsAt=Infinity 로 갱신
 *     (Provider 의 tick loop 이 이 조건을 감지해 entry 제거)
 *   - EN_ROUTE 완료 → IDLE. isMatched=true 면 5~30초 후 재시작;
 *     false 면 phaseEndsAt=Infinity (멈춤)
 */
export function advanceBikeState(
  prev: SimulatedBikeState,
  nowMs: number,
  isMatched: boolean,
  random: () => number = Math.random
): SimulatedBikeState {
  if (nowMs < prev.phaseEndsAt) {
    // 같은 phase 안 — EN_ROUTE 면 위치 / odometer / battery 만 advance.
    if (prev.phase !== "EN_ROUTE" || !prev.destination) return prev;
    const total = prev.phaseEndsAt - prev.phaseStartedAt;
    const elapsed = nowMs - prev.phaseStartedAt;
    const progress = total > 0 ? elapsed / total : 1;
    const position = prev.routeWaypoints
      ? walkPolyline(prev.routeWaypoints, progress)
      : lerpPosition(prev.origin, prev.destination, progress);
    const distanceKm = approxDistanceKm(prev.origin, prev.destination);
    const totalSeconds = EN_ROUTE_DURATION_MS / 1_000;
    // 250ms tick 기준 delta: (초당 변화량) × (tick_ms / 1000)
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

  // phaseEndsAt 도달 — 다음 phase 로 전환.
  switch (prev.phase) {
    case "IDLE": {
      if (!isMatched) {
        // 매칭 없음 → 영원히 IDLE. cleanup 로직이 이 entry 를 제거.
        return { ...prev, phaseEndsAt: Number.POSITIVE_INFINITY };
      }
      const destination = randomSeoulPoint(random);
      return {
        ...prev,
        phase: "EN_ROUTE",
        destination,
        progress: 0,
        position: prev.origin,
        phaseStartedAt: nowMs,
        phaseEndsAt: nowMs + EN_ROUTE_DURATION_MS,
        speedKph: EN_ROUTE_SPEED_KPH,
        ignitionStatus: "ON",
        routeWaypoints: null
      };
    }
    case "EN_ROUTE": {
      const finalPosition = prev.destination ?? prev.origin;
      const idleMs = isMatched
        ? IDLE_BETWEEN_DELIVERIES_MIN_MS +
          Math.floor(random() * (IDLE_BETWEEN_DELIVERIES_MAX_MS - IDLE_BETWEEN_DELIVERIES_MIN_MS))
        : Number.POSITIVE_INFINITY;
      const idlePhaseEndsAt = idleMs === Number.POSITIVE_INFINITY ? idleMs : nowMs + idleMs;
      return {
        ...prev,
        phase: "IDLE",
        progress: 0,
        position: finalPosition,
        origin: finalPosition,
        destination: null,
        phaseStartedAt: nowMs,
        phaseEndsAt: idlePhaseEndsAt,
        speedKph: 0,
        ignitionStatus: "OFF",
        routeWaypoints: null
      };
    }
  }
}

/**
 * 새로운 시뮬레이션 entry 초기값. Provider 의 자동 트리거가 이 함수를 호출.
 *
 * `phase: "EN_ROUTE"` — 매칭 직후 즉시 배송 시작.
 * `phase: "IDLE"` — phaseEndsAt=Infinity 로 초기화 (비매칭 대기).
 */
export function makeInitialState(input: {
  bikeId: string;
  origin: { lat: number; lng: number };
  nowMs: number;
  phase: "IDLE" | "EN_ROUTE";
  random?: () => number;
  initialOdometerKm?: number;
  initialBatteryPercent?: number;
}): SimulatedBikeState {
  const {
    bikeId,
    origin,
    nowMs,
    phase,
    random = Math.random,
    initialOdometerKm = 0,
    initialBatteryPercent = 90
  } = input;

  if (phase === "EN_ROUTE") {
    return {
      bikeId,
      phase: "EN_ROUTE",
      origin,
      destination: randomSeoulPoint(random),
      progress: 0,
      position: origin,
      phaseStartedAt: nowMs,
      phaseEndsAt: nowMs + EN_ROUTE_DURATION_MS,
      speedKph: EN_ROUTE_SPEED_KPH,
      ignitionStatus: "ON",
      odometerKm: initialOdometerKm,
      batteryPercent: initialBatteryPercent,
      routeWaypoints: null
    };
  }

  // IDLE — phaseEndsAt=Infinity, isMatched 가 true 가 될 때 EN_ROUTE 로 전환.
  return {
    bikeId,
    phase: "IDLE",
    origin,
    destination: null,
    progress: 0,
    position: origin,
    phaseStartedAt: nowMs,
    phaseEndsAt: Number.POSITIVE_INFINITY,
    speedKph: 0,
    ignitionStatus: "OFF",
    odometerKm: initialOdometerKm,
    batteryPercent: initialBatteryPercent,
    routeWaypoints: null
  };
}
