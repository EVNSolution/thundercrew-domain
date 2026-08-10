/**
 * 배송 차량 시뮬레이션 엔진.
 *
 * 실차량 텔레메트리가 들어오기 전까지 지도에서 움직이는 것을 보여주기 위한
 * QA/시연 수단이다. `VITE_TC_SIMULATION` 이 켜져 있을 때만 동작하고,
 * 화면에는 항상 "시뮬레이션" 배지를 띄워 운영 데이터와 헷갈리지 않게 한다.
 *
 * 기존 Next.js 콘솔의 `lib/services/fleet-simulation.ts` 와 같은 동작을 하지만
 * 그대로 옮기지 않고 다시 썼다. 옛 구현은 `ServiceType`
 * (CALL/SINGLE/SEQUENTIAL/ROUND/OTHER) 분기를 갖고 있는데, 새 모델에서 배송은
 * 방식 개념이 없고 순서도 없다(주문 풀). 그 분기를 들고 오면 죽은 개념이
 * 새 코드에 다시 심긴다.
 *
 * 순수 함수로 둔다. React 나 브라우저 API 를 참조하지 않아 테스트할 수 있다.
 */

export type ServicePhase = 'MOVING' | 'WORKING' | 'IDLE';

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export interface SimulatedVehicle {
  readonly id: string;
  readonly plateNumber: string;
  readonly zoneId: string;
  /** 현재 위치. */
  readonly position: LatLng;
  /** 이동 중이면 목표 지점. IDLE/WORKING 이면 null. */
  readonly target: LatLng | null;
  readonly phase: ServicePhase;
  /** 현재 phase 가 끝나는 시각(ms epoch). */
  readonly phaseEndsAt: number;
  readonly batteryPercent: number;
  /** 이 차량이 잡은 주문 수. */
  readonly heldOrderCount: number;
  readonly riderName: string | null;
}

export const TICK_INTERVAL_MS = 250;

/**
 * 실주행 속도. 이 값 그대로 실시간으로 움직이면 지도에서 보이지 않는다.
 * 30km/h = 초당 8.3m 인데 zoom 11 에서는 1픽셀이 약 76m 라 초당 0.1픽셀이다.
 * 그래서 `speedMultiplier` 로 시간을 가속한다 (§advanceVehicle).
 */
const MOVING_SPEED_KPH = 30;
const BATTERY_DROP_PER_SECOND = 0.05;
const WORKING_DURATION_MIN_MS = 8_000;
const WORKING_DURATION_MAX_MS = 30_000;
const IDLE_DURATION_MIN_MS = 5_000;
const IDLE_DURATION_MAX_MS = 20_000;

const EARTH_RADIUS_KM = 6371;

/** 하버사인 근사. 서울 규모에서는 충분하다. */
export function approxDistanceKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pickBetween(min: number, max: number, random: () => number): number {
  return min + random() * (max - min);
}

/**
 * 권역 중심 주변의 임의 지점. 시뮬레이션 목표 지점을 만들 때 쓴다.
 * 권역을 벗어나 서울 밖으로 튀지 않도록 반경을 제한한다.
 */
export function randomPointNear(center: LatLng, radiusKm: number, random: () => number): LatLng {
  const angle = random() * Math.PI * 2;
  const distance = Math.sqrt(random()) * radiusKm;
  const dLat = (distance / EARTH_RADIUS_KM) * (180 / Math.PI);
  const dLng =
    (distance / (EARTH_RADIUS_KM * Math.cos((center.lat * Math.PI) / 180))) * (180 / Math.PI);
  return {
    lat: center.lat + dLat * Math.sin(angle),
    lng: center.lng + dLng * Math.cos(angle),
  };
}

/**
 * 한 차량의 상태를 `elapsedMs` 만큼 진행시킨다.
 *
 * MOVING  — 목표까지 남은 거리를 속도로 나눠 보간 이동. 도착하면 WORKING.
 * WORKING — 배송 처리 중. 끝나면 IDLE 이 되고 잡은 주문이 하나 줄어든다.
 * IDLE    — 대기. 끝나면 새 목표를 받아 MOVING.
 */
export function advanceVehicle(
  vehicle: SimulatedVehicle,
  now: number,
  elapsedRealMs: number,
  nextTarget: () => LatLng,
  random: () => number,
  speedMultiplier = 1,
): SimulatedVehicle {
  // 시뮬레이션 시간은 실제 시간보다 빠르게 흐른다. 그래야 지도에서 이동이 보인다.
  const elapsedMs = elapsedRealMs * speedMultiplier;

  const batteryPercent = Math.max(
    5,
    vehicle.batteryPercent - (elapsedMs / 1000) * BATTERY_DROP_PER_SECOND,
  );

  if (vehicle.phase === 'MOVING') {
    if (!vehicle.target) {
      return { ...vehicle, batteryPercent, phase: 'IDLE', phaseEndsAt: now };
    }
    const remainingKm = approxDistanceKm(vehicle.position, vehicle.target);
    const stepKm = (MOVING_SPEED_KPH / 3600) * (elapsedMs / 1000);

    if (remainingKm <= stepKm || remainingKm < 0.01) {
      return {
        ...vehicle,
        batteryPercent,
        position: vehicle.target,
        target: null,
        phase: 'WORKING',
        phaseEndsAt:
          now +
          pickBetween(WORKING_DURATION_MIN_MS, WORKING_DURATION_MAX_MS, random) / speedMultiplier,
      };
    }

    const t = stepKm / remainingKm;
    return {
      ...vehicle,
      batteryPercent,
      position: {
        lat: lerp(vehicle.position.lat, vehicle.target.lat, t),
        lng: lerp(vehicle.position.lng, vehicle.target.lng, t),
      },
    };
  }

  if (now < vehicle.phaseEndsAt) {
    return { ...vehicle, batteryPercent };
  }

  if (vehicle.phase === 'WORKING') {
    return {
      ...vehicle,
      batteryPercent,
      phase: 'IDLE',
      heldOrderCount: Math.max(0, vehicle.heldOrderCount - 1),
      phaseEndsAt:
        now + pickBetween(IDLE_DURATION_MIN_MS, IDLE_DURATION_MAX_MS, random) / speedMultiplier,
    };
  }

  // IDLE 종료 → 새 주문을 잡고 이동 시작.
  return {
    ...vehicle,
    batteryPercent,
    phase: 'MOVING',
    target: nextTarget(),
    heldOrderCount: vehicle.heldOrderCount + 1,
    phaseEndsAt: now,
  };
}

export function advanceFleet(
  fleet: readonly SimulatedVehicle[],
  now: number,
  elapsedRealMs: number,
  nextTargetFor: (vehicle: SimulatedVehicle) => LatLng,
  random: () => number = Math.random,
  speedMultiplier = 1,
): SimulatedVehicle[] {
  return fleet.map((vehicle) =>
    advanceVehicle(
      vehicle,
      now,
      elapsedRealMs,
      () => nextTargetFor(vehicle),
      random,
      speedMultiplier,
    ),
  );
}

export const PHASE_LABEL: Record<ServicePhase, string> = {
  MOVING: '이동 중',
  WORKING: '배송 처리',
  IDLE: '대기',
};
