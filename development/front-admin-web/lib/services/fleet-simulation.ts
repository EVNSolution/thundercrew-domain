/**
 * Fleet 배송 시뮬레이션의 순수 데이터 모델 + phase 진행 함수.
 *
 * Provider 가 useEffect tick 안에서 `advanceBikeState(prev, now)` 를 호출해
 * 다음 phase / position / 텔레메트리 부속 값을 받는다. React / DOM / window
 * 접근 없음.
 */

export type DeliveryPhase = "IDLE" | "ASSIGNED" | "EN_ROUTE" | "ARRIVED";

export type SimulatedBikeState = {
  bikeId: string;
  phase: DeliveryPhase;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number } | null;
  /** EN_ROUTE 진행률 0..1. 그 외 phase 에선 0. */
  progress: number;
  /** 현재 표시 위치 — origin → destination 보간 결과 또는 phase 별 고정. */
  position: { lat: number; lng: number };
  /** 이 phase 의 시작 ms */
  phaseStartedAt: number;
  /** 이 phase 의 종료 예정 ms */
  phaseEndsAt: number;
  /** 현재 표시 속도 km/h */
  speedKph: number;
  /** 현재 시동. EN_ROUTE 만 ON. */
  ignitionStatus: "ON" | "OFF";
  /** 누적 km. EN_ROUTE 중 점진 증가. */
  odometerKm: number;
  /** 배터리 %. EN_ROUTE 중 0.05/tick 감소. */
  batteryPercent: number;
  /** 운영자가 단일 차량 수동 배정으로 만든 entry 인지. fleet 정지 후에도 살아 있는다. */
  manualOrigin: boolean;
};

// Phase 길이 (ms). 스펙 표 참고.
export const ASSIGNED_DURATION_MS = 5_000;
export const EN_ROUTE_DURATION_MS = 5 * 60 * 1_000;
export const ARRIVED_DURATION_MS = 10_000;
/** Fleet 모드의 IDLE → ASSIGNED staggered window. 0..MAX 사이 random. */
export const IDLE_FLEET_MAX_MS = 30_000;
/** EN_ROUTE 시 표시 속도 (km/h). 거리 / 시간 비례 odometer 증가에도 사용. */
export const EN_ROUTE_SPEED_KPH = 30;
/** 매 tick (1초) 당 배터리 감소량. EN_ROUTE 만 발화. */
export const BATTERY_DROP_PER_TICK = 0.05;

const SEOUL_LAT_MIN = 37.44;
const SEOUL_LAT_MAX = 37.65;
const SEOUL_LNG_MIN = 126.87;
const SEOUL_LNG_MAX = 127.10;

/**
 * 서울 박스 안 random 좌표. fleet 의 destination 으로 쓴다. 시뮬레이션이
 * 매번 새 random 값을 줘야 사이클마다 다른 목적지로 가는 데모 효과가 난다.
 * 결정성이 필요한 경우(테스트 등) `random` 시드 함수를 외부에서 주입.
 */
export function randomSeoulPoint(random: () => number = Math.random): { lat: number; lng: number } {
  return {
    lat: SEOUL_LAT_MIN + random() * (SEOUL_LAT_MAX - SEOUL_LAT_MIN),
    lng: SEOUL_LNG_MIN + random() * (SEOUL_LNG_MAX - SEOUL_LNG_MIN)
  };
}

/** Haversine 대신 단순 평면 근사 — 데모 표시용이라 km 단위 오차 무방. */
export function approxDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 88; // 한국 위도대 평균 cos × 111 ≈ 88
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** lerp 보간 — t 가 0..1 사이일 때 from → to. clamp 포함. */
export function lerpPosition(from: { lat: number; lng: number }, to: { lat: number; lng: number }, t: number): {
  lat: number;
  lng: number;
} {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    lat: from.lat + (to.lat - from.lat) * clamped,
    lng: from.lng + (to.lng - from.lng) * clamped
  };
}

/**
 * 1초 tick 마다 호출되어 prev 의 phase / position / 부속 값을 advance.
 * `nowMs` 는 호출자가 주입 — 테스트 결정성 + 동일 tick 의 여러 차량이 같은
 * 기준 시각을 보도록.
 *
 * `fleetRunning` 이 false 이면 IDLE → ASSIGNED 자동 전환이 발생하지 않는다
 * (manual origin 만 살아남는다). EN_ROUTE / ARRIVED 사이클은 그대로 마저
 * 돌고 IDLE 로 가서 멈춘다.
 */
export function advanceBikeState(
  prev: SimulatedBikeState,
  nowMs: number,
  fleetRunning: boolean,
  random: () => number = Math.random
): SimulatedBikeState {
  if (nowMs < prev.phaseEndsAt) {
    // 같은 phase 안 — EN_ROUTE 면 position / odometer / battery 만 advance.
    if (prev.phase !== "EN_ROUTE" || !prev.destination) return prev;
    const total = prev.phaseEndsAt - prev.phaseStartedAt;
    const elapsed = nowMs - prev.phaseStartedAt;
    const progress = total > 0 ? elapsed / total : 1;
    const position = lerpPosition(prev.origin, prev.destination, progress);
    // 1 tick = 1초 가정. 거리 / 시간 = 속도 → 시간당 거리 / 3600 = 초당 거리.
    const distanceKm = approxDistanceKm(prev.origin, prev.destination);
    const totalSeconds = EN_ROUTE_DURATION_MS / 1_000;
    const odometerDelta = totalSeconds > 0 ? distanceKm / totalSeconds : 0;
    return {
      ...prev,
      progress,
      position,
      odometerKm: prev.odometerKm + odometerDelta,
      batteryPercent: Math.max(0, prev.batteryPercent - BATTERY_DROP_PER_TICK)
    };
  }

  // phaseEndsAt 도달 — 다음 phase 로 전환.
  switch (prev.phase) {
    case "IDLE": {
      if (!fleetRunning && !prev.manualOrigin) {
        // fleet 끄고 manual 도 아닌 IDLE 은 다시 ASSIGN 하지 않음.
        return prev;
      }
      const destination = randomSeoulPoint(random);
      return {
        ...prev,
        phase: "ASSIGNED",
        destination,
        progress: 0,
        position: prev.origin,
        phaseStartedAt: nowMs,
        phaseEndsAt: nowMs + ASSIGNED_DURATION_MS,
        speedKph: 0,
        ignitionStatus: "OFF"
      };
    }
    case "ASSIGNED": {
      return {
        ...prev,
        phase: "EN_ROUTE",
        progress: 0,
        position: prev.origin,
        phaseStartedAt: nowMs,
        phaseEndsAt: nowMs + EN_ROUTE_DURATION_MS,
        speedKph: EN_ROUTE_SPEED_KPH,
        ignitionStatus: "ON"
      };
    }
    case "EN_ROUTE": {
      const finalPosition = prev.destination ?? prev.origin;
      return {
        ...prev,
        phase: "ARRIVED",
        progress: 1,
        position: finalPosition,
        // 도착지가 다음 사이클의 origin 이 된다.
        origin: finalPosition,
        destination: null,
        phaseStartedAt: nowMs,
        phaseEndsAt: nowMs + ARRIVED_DURATION_MS,
        speedKph: 0,
        ignitionStatus: "OFF"
      };
    }
    case "ARRIVED": {
      // IDLE 로 복귀. fleet 모드면 staggered 다음 사이클; 아니면 그대로 머묾.
      const idleWindow = fleetRunning ? Math.floor(random() * IDLE_FLEET_MAX_MS) : Number.POSITIVE_INFINITY;
      return {
        ...prev,
        phase: "IDLE",
        progress: 0,
        // position 유지 — origin 자리에 있음.
        phaseStartedAt: nowMs,
        phaseEndsAt: idleWindow === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : nowMs + idleWindow,
        speedKph: 0,
        ignitionStatus: "OFF"
      };
    }
  }
}

/**
 * 새로운 시뮬레이션 entry 를 만들 때 호출. fleet seed 와 manual assign 모두
 * 이 함수를 거쳐 일관된 초기값을 받는다. `phase` 는 호출자가 결정 — fleet
 * 은 IDLE (staggered), manual 은 ASSIGNED 직행.
 */
export function makeInitialState(input: {
  bikeId: string;
  origin: { lat: number; lng: number };
  nowMs: number;
  phase: "IDLE" | "ASSIGNED";
  manualOrigin: boolean;
  staggerMs?: number;
  random?: () => number;
  initialOdometerKm?: number;
  initialBatteryPercent?: number;
}): SimulatedBikeState {
  const {
    bikeId,
    origin,
    nowMs,
    phase,
    manualOrigin,
    staggerMs,
    random = Math.random,
    initialOdometerKm = 0,
    initialBatteryPercent = 90
  } = input;
  if (phase === "ASSIGNED") {
    return {
      bikeId,
      phase: "ASSIGNED",
      origin,
      destination: randomSeoulPoint(random),
      progress: 0,
      position: origin,
      phaseStartedAt: nowMs,
      phaseEndsAt: nowMs + ASSIGNED_DURATION_MS,
      speedKph: 0,
      ignitionStatus: "OFF",
      odometerKm: initialOdometerKm,
      batteryPercent: initialBatteryPercent,
      manualOrigin
    };
  }
  const stagger = staggerMs ?? Math.floor(random() * IDLE_FLEET_MAX_MS);
  return {
    bikeId,
    phase: "IDLE",
    origin,
    destination: null,
    progress: 0,
    position: origin,
    phaseStartedAt: nowMs,
    phaseEndsAt: nowMs + stagger,
    speedKph: 0,
    ignitionStatus: "OFF",
    odometerKm: initialOdometerKm,
    batteryPercent: initialBatteryPercent,
    manualOrigin
  };
}
