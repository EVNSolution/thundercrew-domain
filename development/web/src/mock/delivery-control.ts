import type { LatLng, SimulatedVehicle } from '../features/control/fleet-simulation';

/**
 * 배송용 관제 mock 데이터 — 권역·스테이션·차량 초기 배치.
 *
 * 주문은 여기 없다. order-store.ts 가 소유한다.
 * 차량·인력·계약은 fleet-store.ts 가 소유한다.
 *
 * `VITE_TC_API_MODE=mock` 일 때만 쓴다. remote 모드에서 요청이 실패해도
 * 이 데이터로 대체하지 않는다 — 오류를 그대로 보여준다.
 */

export interface Zone {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly center: LatLng;
}

export interface Station {
  readonly id: string;
  readonly name: string;
  readonly position: LatLng;
  readonly batteryCount: number;
}

/** 권역 색은 상태색(초록·빨강·주황)과 혼동되지 않는 범위에서만 고른다. */
export const ZONES: readonly Zone[] = [
  { id: 'gangnam', name: '강남권', color: '#0066cc', center: { lat: 37.4979, lng: 127.0276 } },
  { id: 'songpa', name: '송파권', color: '#7a5af8', center: { lat: 37.5145, lng: 127.1059 } },
  { id: 'mapo', name: '마포권', color: '#0a7ea4', center: { lat: 37.5563, lng: 126.9236 } },
];

export const STATIONS: readonly Station[] = [
  { id: 'st-1', name: '역삼 스테이션', position: { lat: 37.5006, lng: 127.0364 }, batteryCount: 18 },
  { id: 'st-2', name: '잠실 스테이션', position: { lat: 37.5133, lng: 127.1 }, batteryCount: 11 },
  { id: 'st-3', name: '합정 스테이션', position: { lat: 37.5495, lng: 126.9137 }, batteryCount: 6 },
];

/**
 * 차량이 잡은 주문. **배송원당 최대 1건**이다 (03-screen-feature-map.md §3.1).
 * 처리 중인 건이 없을 때만 새로 잡을 수 있으므로 목록이 아니라 0 또는 1개다.
 */

/**
 * 배송용 차량의 배송원. **배송용 차량만 넣는다.**
 *
 * 56다 1122 / 최유진 은 클린차량과 클리너다(fleet-store). 전에는 여기에도
 * 들어 있어서 같은 차량이 배송 관제와 클리닝 관제에 동시에 떴고, 진단의
 * "주문 → 용도 정합" 점검이 이것을 실패로 잡았다. 용도는 차량이 소유하는
 * 하나의 값이므로 양쪽에 둘 수 없다.
 */
export const RIDERS: Record<string, string> = {
  'bike-1': '김도현',
  'bike-2': '이수민',
  'bike-3': '정민아',
};

/** 시뮬레이션 시작 상태. 권역 중심 근처에 흩뿌린다. */
export function initialFleet(now: number): SimulatedVehicle[] {
  const seeds: ReadonlyArray<{
    id: string;
    plateNumber: string;
    zoneId: string;
    battery: number;
  }> = [
    { id: 'bike-1', plateNumber: '12가 3456', zoneId: 'gangnam', battery: 72 },
    { id: 'bike-2', plateNumber: '34나 7788', zoneId: 'mapo', battery: 54 },
    { id: 'bike-3', plateNumber: '78라 9900', zoneId: 'gangnam', battery: 31 },
  ];

  return seeds.map((seed, index) => {
    const zone = ZONES.find((candidate) => candidate.id === seed.zoneId) ?? ZONES[0];
    // 초기 배치는 결정적으로 둔다. 새로고침마다 위치가 튀면 QA 가 어렵다.
    const offset = (index + 1) * 0.004;
    return {
      id: seed.id,
      plateNumber: seed.plateNumber,
      zoneId: seed.zoneId,
      position: { lat: zone.center.lat + offset, lng: zone.center.lng - offset },
      target: null,
      phase: 'IDLE',
      phaseEndsAt: now + 2_000 * (index + 1),
      batteryPercent: seed.battery,
      riderName: RIDERS[seed.id] ?? null,
    } satisfies SimulatedVehicle;
  });
}

/** 텔레메트리 미수신으로 취급하는 차량. 상태 칩을 위험으로 표시한다. */
export const STALE_TELEMETRY_BIKE_IDS: readonly string[] = ['bike-3'];

export function zoneById(id: string): Zone | undefined {
  return ZONES.find((zone) => zone.id === id);
}

/** 배차 화면의 "잡힌 주문" 표. 배송원당 1건이므로 행 하나가 배송원 하나다. */

/** 지금 아무 주문도 잡지 않은 배송원. 운영자가 직접 배정할 때 후보가 된다. */
