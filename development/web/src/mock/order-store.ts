import { RIDERS, ZONES } from './delivery-control';

/**
 * 배송 주문 mock 스토어.
 *
 * `VITE_TC_API_MODE=mock` 일 때 배차·관제 화면이 공유하는 유일한 주문 상태다.
 * remote 모드에서는 쓰지 않는다 — 요청이 실패해도 이 데이터로 대체하지 않는다.
 *
 * 역할 분리:
 *   - 이 스토어가 **주문 상태**를 소유한다 (등록·잡기·반납·완료·회수).
 *   - 시뮬레이션은 **차량 위치**만 담당한다. 주문을 만들거나 없애지 않는다.
 *
 * 시뮬레이션이 주문까지 건드리면 안 되는 이유: 시뮬레이션은 60배 가속이라
 * WORKING 이 실시간 0.2초 남짓이다. 주문을 자동 완료시키면 눌러보기 전에
 * 풀이 비어버려 QA 를 할 수 없다. 주문은 사람이 누를 때만 움직인다.
 *
 * 규칙은 docs/frontend/03-screen-feature-map.md §3.1 을 따른다.
 *   - 배송원은 동시에 1건만 잡는다
 *   - 반납하면 풀로 돌아가고 return_count 가 올라간다
 *   - 경과 시간은 최초 등록이 아니라 마지막 반납 시각부터 센다
 */

export type OrderStatus = 'OFFERED' | 'ASSIGNED' | 'DONE' | 'WITHDRAWN';
export type AssignmentMode = 'OFFER' | 'OPERATOR';

export interface Order {
  readonly id: string;
  readonly customerName: string;
  readonly phone: string;
  readonly address: string;
  readonly zoneId: string;
  readonly position: { lat: number; lng: number };
  readonly memo: string;
  readonly status: OrderStatus;
  /** 최초 등록 시각(epoch ms). */
  readonly registeredAt: number;
  /**
   * 풀에 들어온 시각(epoch ms). 최초 등록 또는 마지막 반납 시각이다.
   * 경과 시간은 이 값 기준으로 센다.
   */
  readonly poolSince: number;
  readonly claimedAt: number | null;
  readonly completedAt: number | null;
  readonly returnedAt: number | null;
  readonly returnCount: number;
  readonly assignedBikeId: string | null;
  readonly assignmentMode: AssignmentMode | null;
}

export interface Rider {
  readonly bikeId: string;
  readonly plateNumber: string;
  readonly riderName: string;
}

export const RIDER_FLEET: readonly Rider[] = [
  { bikeId: 'bike-1', plateNumber: '12가 3456', riderName: RIDERS['bike-1'] },
  { bikeId: 'bike-2', plateNumber: '34나 7788', riderName: RIDERS['bike-2'] },
  { bikeId: 'bike-3', plateNumber: '78라 9900', riderName: RIDERS['bike-3'] },
  { bikeId: 'bike-4', plateNumber: '56다 1122', riderName: RIDERS['bike-4'] },
];

export interface OrderStoreState {
  readonly orders: readonly Order[];
  /** 마지막 동작 결과. 거부된 동작의 이유를 화면에 그대로 보여준다. */
  readonly lastMessage: { kind: 'ok' | 'rejected'; text: string } | null;
}

const MINUTE = 60_000;

function minutesAgo(minutes: number): number {
  return Date.now() - minutes * MINUTE;
}

function seed(): Order[] {
  const base = (
    [
      ['ord-1', '박서준', '010-2201-8841', '서울 강남구 역삼동 812', 'gangnam', 37.5015, 127.0421, 18, 0],
      ['ord-2', '이하늘', '010-4417-2093', '서울 강남구 논현동 44', 'gangnam', 37.5112, 127.0224, 12, 2],
      ['ord-3', '정예린', '010-9930-1174', '서울 마포구 합정동 90', 'mapo', 37.5501, 126.9095, 3, 0],
      ['ord-4', '김태오', '010-3388-5520', '서울 마포구 연남동 220', 'mapo', 37.5622, 126.9256, 1, 1],
    ] as const
  ).map(([id, customerName, phone, address, zoneId, lat, lng, waiting, returnCount]) => ({
    id,
    customerName,
    phone,
    address,
    zoneId,
    position: { lat, lng },
    memo: '',
    status: 'OFFERED' as OrderStatus,
    registeredAt: minutesAgo(waiting + returnCount * 9),
    poolSince: minutesAgo(waiting),
    claimedAt: null,
    completedAt: null,
    returnedAt: returnCount > 0 ? minutesAgo(waiting) : null,
    returnCount,
    assignedBikeId: null,
    assignmentMode: null,
  }));

  const assigned: Order[] = (
    [
      ['ord-10', '한지우', '010-7742-0091', '서울 강남구 삼성동 159', 'gangnam', 37.5108, 127.0562, 'bike-1', 32, 18, 'OFFER', 0],
      ['ord-11', '오세라', '010-6620-3388', '서울 마포구 합정동 21', 'mapo', 37.5489, 126.9138, 'bike-2', 35, 21, 'OPERATOR', 1],
      ['ord-12', '문가온', '010-5514-7729', '서울 송파구 문정동 55', 'songpa', 37.4852, 127.1218, 'bike-4', 9, 9, 'OFFER', 0],
    ] as const
  ).map(
    ([id, customerName, phone, address, zoneId, lat, lng, bikeId, regAgo, wait, mode, returnCount]) => ({
      id,
      customerName,
      phone,
      address,
      zoneId,
      position: { lat, lng },
      memo: '',
      status: 'ASSIGNED' as OrderStatus,
      registeredAt: minutesAgo(regAgo),
      poolSince: minutesAgo(regAgo),
      claimedAt: minutesAgo(regAgo - wait),
      completedAt: null,
      returnedAt: null,
      returnCount,
      assignedBikeId: bikeId,
      assignmentMode: mode as AssignmentMode,
    }),
  );

  return [...base, ...assigned];
}

let state: OrderStoreState = { orders: seed(), lastMessage: null };
const listeners = new Set<() => void>();
let sequence = 100;

function emit(next: OrderStoreState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): OrderStoreState {
  return state;
}

function patch(id: string, changes: Partial<Order>): readonly Order[] {
  return state.orders.map((order) => (order.id === id ? { ...order, ...changes } : order));
}

/** 그 배송원이 지금 잡고 있는 주문. 없으면 null. 동시 1건 규칙의 근거다. */
export function heldOrderOf(orders: readonly Order[], bikeId: string): Order | null {
  return orders.find((o) => o.status === 'ASSIGNED' && o.assignedBikeId === bikeId) ?? null;
}

export function poolOrders(orders: readonly Order[]): readonly Order[] {
  // 오래 기다린 것이 위로. 풀에 우선순위는 없지만 방치를 먼저 보여준다.
  return orders
    .filter((o) => o.status === 'OFFERED')
    .slice()
    .sort((a, b) => a.poolSince - b.poolSince);
}

export function assignedOrders(orders: readonly Order[]): readonly Order[] {
  return orders
    .filter((o) => o.status === 'ASSIGNED')
    .slice()
    .sort((a, b) => (a.claimedAt ?? 0) - (b.claimedAt ?? 0));
}

export function idleRiders(orders: readonly Order[]): readonly Rider[] {
  return RIDER_FLEET.filter((rider) => heldOrderOf(orders, rider.bikeId) === null);
}

export function waitingMinutes(order: Order, now: number): number {
  return Math.max(0, Math.floor((now - order.poolSince) / MINUTE));
}

export function poolWaitMinutes(order: Order): number {
  if (order.claimedAt === null) return 0;
  return Math.max(0, Math.floor((order.claimedAt - order.poolSince) / MINUTE));
}

// ---------- 동작 ----------

export function registerOrder(input: {
  customerName: string;
  phone: string;
  address: string;
  zoneId: string;
  memo: string;
}): void {
  const trimmedName = input.customerName.trim();
  const trimmedAddress = input.address.trim();
  if (!trimmedName || !trimmedAddress) {
    emit({
      ...state,
      lastMessage: { kind: 'rejected', text: '고객명과 배송지 주소는 비울 수 없습니다.' },
    });
    return;
  }

  const zone = ZONES.find((candidate) => candidate.id === input.zoneId) ?? ZONES[0];
  sequence += 1;
  const now = Date.now();
  // mock 이라 지오코딩 대신 권역 중심 근처에 흩뿌린다.
  const order: Order = {
    id: `ord-${sequence}`,
    customerName: trimmedName,
    phone: input.phone.trim(),
    address: trimmedAddress,
    zoneId: zone.id,
    position: {
      lat: zone.center.lat + (Math.random() - 0.5) * 0.03,
      lng: zone.center.lng + (Math.random() - 0.5) * 0.03,
    },
    memo: input.memo.trim(),
    status: 'OFFERED',
    registeredAt: now,
    poolSince: now,
    claimedAt: null,
    completedAt: null,
    returnedAt: null,
    returnCount: 0,
    assignedBikeId: null,
    assignmentMode: null,
  };
  emit({
    orders: [...state.orders, order],
    lastMessage: { kind: 'ok', text: `${trimmedName} 주문을 풀에 올렸습니다.` },
  });
}

export function withdrawOrder(id: string): void {
  const order = state.orders.find((candidate) => candidate.id === id);
  if (!order || order.status !== 'OFFERED') {
    emit({ ...state, lastMessage: { kind: 'rejected', text: '풀에 있는 주문만 회수할 수 있습니다.' } });
    return;
  }
  emit({
    orders: patch(id, { status: 'WITHDRAWN' }),
    lastMessage: { kind: 'ok', text: `${order.customerName} 주문을 풀에서 내렸습니다.` },
  });
}

/**
 * 주문을 배송원에게 배정한다.
 * `mode: 'OFFER'` 는 배송원이 스스로 잡은 것, `'OPERATOR'` 는 운영자 지정이다.
 * 어느 경로든 동시 1건 규칙을 지킨다 — 앱에서만 막으면 동시 요청으로 뚫린다.
 */
export function claimOrder(id: string, bikeId: string, mode: AssignmentMode): void {
  const order = state.orders.find((candidate) => candidate.id === id);
  if (!order || order.status !== 'OFFERED') {
    emit({ ...state, lastMessage: { kind: 'rejected', text: '풀에 있는 주문만 잡을 수 있습니다.' } });
    return;
  }
  const held = heldOrderOf(state.orders, bikeId);
  if (held) {
    const rider = RIDER_FLEET.find((candidate) => candidate.bikeId === bikeId);
    emit({
      ...state,
      lastMessage: {
        kind: 'rejected',
        text: `${rider?.riderName ?? bikeId} 은 이미 ${held.address} 를 처리 중입니다. 동시에 1건만 잡을 수 있습니다.`,
      },
    });
    return;
  }
  const rider = RIDER_FLEET.find((candidate) => candidate.bikeId === bikeId);
  emit({
    orders: patch(id, {
      status: 'ASSIGNED',
      assignedBikeId: bikeId,
      assignmentMode: mode,
      claimedAt: Date.now(),
    }),
    lastMessage: {
      kind: 'ok',
      text:
        mode === 'OPERATOR'
          ? `${rider?.riderName ?? bikeId} 에게 직접 배정했습니다.`
          : `${rider?.riderName ?? bikeId} 이 주문을 잡았습니다.`,
    },
  });
}

/** 반납. 같은 주문의 상태만 되돌리고 return_count 를 올린다. */
export function returnOrder(id: string): void {
  const order = state.orders.find((candidate) => candidate.id === id);
  if (!order || order.status !== 'ASSIGNED') {
    emit({ ...state, lastMessage: { kind: 'rejected', text: '잡은 주문만 반납할 수 있습니다.' } });
    return;
  }
  const now = Date.now();
  emit({
    orders: patch(id, {
      status: 'OFFERED',
      assignedBikeId: null,
      assignmentMode: null,
      claimedAt: null,
      returnedAt: now,
      returnCount: order.returnCount + 1,
      // 경과 시간을 반납 시점부터 다시 센다.
      poolSince: now,
    }),
    lastMessage: {
      kind: 'ok',
      text: `${order.address} 를 반납했습니다. 풀로 돌아가고 경과 시간이 0분부터 다시 셉니다.`,
    },
  });
}

export function completeOrder(id: string): void {
  const order = state.orders.find((candidate) => candidate.id === id);
  if (!order || order.status !== 'ASSIGNED') {
    emit({ ...state, lastMessage: { kind: 'rejected', text: '잡은 주문만 완료할 수 있습니다.' } });
    return;
  }
  emit({
    orders: patch(id, { status: 'DONE', completedAt: Date.now() }),
    lastMessage: { kind: 'ok', text: `${order.address} 배송을 완료했습니다.` },
  });
}

export function clearMessage(): void {
  if (state.lastMessage === null) return;
  emit({ ...state, lastMessage: null });
}
