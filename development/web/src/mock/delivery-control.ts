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
  /** 풀에 올라온 뒤 지난 시간(분). 반납된 주문은 마지막 반납 시각부터 센다. */
  readonly waitingMinutes: number;
  /** 반납 횟수. 반복 반납은 주소 오류 같은 실제 문제의 신호다. */
  readonly returnCount: number;
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
    returnCount: 0,
  },
  {
    id: 'ord-2',
    customerName: '이하늘',
    address: '서울 강남구 논현동 44',
    zoneId: 'gangnam',
    position: { lat: 37.5112, lng: 127.0224 },
    waitingMinutes: 12,
    returnCount: 2,
  },
  {
    id: 'ord-3',
    customerName: '정예린',
    address: '서울 마포구 합정동 90',
    zoneId: 'mapo',
    position: { lat: 37.5501, lng: 126.9095 },
    waitingMinutes: 3,
    returnCount: 0,
  },
  {
    id: 'ord-4',
    customerName: '김태오',
    address: '서울 마포구 연남동 220',
    zoneId: 'mapo',
    position: { lat: 37.5622, lng: 126.9256 },
    waitingMinutes: 1,
    returnCount: 1,
  },
];

/**
 * 차량이 잡은 주문. **배송원당 최대 1건**이다 (03-screen-feature-map.md §3.1).
 * 처리 중인 건이 없을 때만 새로 잡을 수 있으므로 목록이 아니라 0 또는 1개다.
 */
export const HELD_ORDER: Record<string, HeldOrder | null> = {
  'bike-1': { id: 'h-1', address: '삼성동 159', claimedAt: '13:58', registeredAt: '13:40' },
  'bike-2': { id: 'h-3', address: '합정동 21', claimedAt: '14:05', registeredAt: '13:44' },
  'bike-3': null,
  'bike-4': { id: 'h-4', address: '문정동 55', claimedAt: '14:31', registeredAt: '14:22' },
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
export interface AssignedOrderRow {
  readonly orderId: string;
  readonly bikeId: string;
  readonly plateNumber: string;
  readonly riderName: string;
  readonly address: string;
  readonly claimedAt: string;
  /** 등록(또는 마지막 반납)에서 잡힘까지 걸린 시간(분). */
  readonly poolWaitMinutes: number;
  /** 잡은 경로. OFFER = 배송원이 스스로, OPERATOR = 운영자가 지정. */
  readonly assignmentMode: 'OFFER' | 'OPERATOR';
  readonly returnCount: number;
}

export const ASSIGNED_ORDERS: readonly AssignedOrderRow[] = [
  {
    orderId: 'h-1',
    bikeId: 'bike-1',
    plateNumber: '12가 3456',
    riderName: '김도현',
    address: '서울 강남구 삼성동 159',
    claimedAt: '13:58',
    poolWaitMinutes: 18,
    assignmentMode: 'OFFER',
    returnCount: 0,
  },
  {
    orderId: 'h-3',
    bikeId: 'bike-2',
    plateNumber: '34나 7788',
    riderName: '이수민',
    address: '서울 마포구 합정동 21',
    claimedAt: '14:05',
    poolWaitMinutes: 21,
    assignmentMode: 'OPERATOR',
    returnCount: 1,
  },
  {
    orderId: 'h-4',
    bikeId: 'bike-4',
    plateNumber: '56다 1122',
    riderName: '최유진',
    address: '서울 송파구 문정동 55',
    claimedAt: '14:31',
    poolWaitMinutes: 9,
    assignmentMode: 'OFFER',
    returnCount: 0,
  },
];

/** 지금 아무 주문도 잡지 않은 배송원. 운영자가 직접 배정할 때 후보가 된다. */
export const IDLE_RIDERS: readonly { bikeId: string; plateNumber: string; riderName: string }[] = [
  { bikeId: 'bike-3', plateNumber: '78라 9900', riderName: '정민아' },
];

/** 설정의 방치 임계(분). 이 시간을 넘게 아무도 잡지 않으면 경보한다. */
export const STALE_ORDER_THRESHOLD_MINUTES = 10;
