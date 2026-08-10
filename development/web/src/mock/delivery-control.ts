import type { LatLng, SimulatedVehicle } from '../features/control/fleet-simulation';

/**
 * 배송용 관제 mock 데이터.
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

export interface UnassignedOrder {
  readonly id: string;
  readonly customerName: string;
  readonly address: string;
  readonly zoneId: string;
  readonly position: LatLng;
  /** 풀에 올라온 뒤 지난 시간(분). */
  readonly waitingMinutes: number;
}

export interface HeldOrder {
  readonly id: string;
  readonly address: string;
  /** 잡은 시각. 순서 개념이 없으므로 이 값이 정렬 기준이다. */
  readonly claimedAt: string;
  readonly registeredAt: string;
}

/** 권역 색은 상태색(초록·빨강·주황)과 혼동되지 않는 범위에서만 고른다. */
export const ZONES: readonly Zone[] = [
  { id: 'gangnam', name: '강남권', color: '#0066cc', center: { lat: 37.4979, lng: 127.0276 } },
  { id: 'songpa', name: '송파권', color: '#7a5af8', center: { lat: 37.5145, lng: 127.1059 } },
  { id: 'mapo', name: '마포권', color: '#0a7ea4', center: { lat: 37.5563, lng: 126.9236 } },
];

export const UNZONED_COLOR = '#8e8e93';

export const STATIONS: readonly Station[] = [
  { id: 'st-1', name: '역삼 스테이션', position: { lat: 37.5006, lng: 127.0364 }, batteryCount: 18 },
  { id: 'st-2', name: '잠실 스테이션', position: { lat: 37.5133, lng: 127.1 }, batteryCount: 11 },
  { id: 'st-3', name: '합정 스테이션', position: { lat: 37.5495, lng: 126.9137 }, batteryCount: 6 },
];

export const UNASSIGNED_ORDERS: readonly UnassignedOrder[] = [
  {
    id: 'ord-1',
    customerName: '박서준',
    address: '서울 강남구 역삼동 812',
    zoneId: 'gangnam',
    position: { lat: 37.5015, lng: 127.0421 },
    waitingMinutes: 18,
  },
  {
    id: 'ord-2',
    customerName: '이하늘',
    address: '서울 강남구 논현동 44',
    zoneId: 'gangnam',
    position: { lat: 37.5112, lng: 127.0224 },
    waitingMinutes: 12,
  },
  {
    id: 'ord-3',
    customerName: '정예린',
    address: '서울 마포구 합정동 90',
    zoneId: 'mapo',
    position: { lat: 37.5501, lng: 126.9095 },
    waitingMinutes: 3,
  },
  {
    id: 'ord-4',
    customerName: '김태오',
    address: '서울 마포구 연남동 220',
    zoneId: 'mapo',
    position: { lat: 37.5622, lng: 126.9256 },
    waitingMinutes: 1,
  },
];

/** 차량이 잡은 주문. 순서 번호가 없고 잡은 시각순으로만 정렬한다. */
export const HELD_ORDERS: Record<string, readonly HeldOrder[]> = {
  'bike-1': [
    { id: 'h-1', address: '삼성동 159', claimedAt: '13:58', registeredAt: '13:40' },
    { id: 'h-2', address: '대치동 501', claimedAt: '14:20', registeredAt: '14:11' },
  ],
  'bike-2': [{ id: 'h-3', address: '합정동 21', claimedAt: '14:05', registeredAt: '13:44' }],
  'bike-3': [],
  'bike-4': [{ id: 'h-4', address: '문정동 55', claimedAt: '14:31', registeredAt: '14:22' }],
};

export const RIDERS: Record<string, string> = {
  'bike-1': '김도현',
  'bike-2': '이수민',
  'bike-3': '정민아',
  'bike-4': '최유진',
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
    { id: 'bike-4', plateNumber: '56다 1122', zoneId: 'songpa', battery: 88 },
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
      heldOrderCount: HELD_ORDERS[seed.id]?.length ?? 0,
      riderName: RIDERS[seed.id] ?? null,
    } satisfies SimulatedVehicle;
  });
}

/** 텔레메트리 미수신으로 취급하는 차량. 상태 칩을 위험으로 표시한다. */
export const STALE_TELEMETRY_BIKE_IDS: readonly string[] = ['bike-3'];

export function zoneById(id: string): Zone | undefined {
  return ZONES.find((zone) => zone.id === id);
}
