import { ZONES } from './delivery-control';

/**
 * 클리닝 예약 mock 스토어.
 *
 * 배송과 근본이 다르다. 배송은 주문 풀이고 클리닝은 **시간 예약**이다.
 *   - 운영자가 예정 시각을 지정한다. 배송원이 잡는 구조가 아니다.
 *   - **예정 시각순이 방문 순서다.** 순서를 손으로 매기지 않는다 (§7.1).
 *     그래서 sequence 를 저장하지 않고 조회 시 정렬한다.
 *   - 같은 차량의 [예정 시각, 예정 시각 + 예상 소요) 구간이 겹치면 경고한다.
 *
 * 기준: docs/frontend/03-screen-feature-map.md §7
 */

export type CleaningMethod = 'SEQUENTIAL' | 'ROUND';
export type ReservationStatus = 'RESERVED' | 'ACTIVE' | 'DONE';
/** 왕복만 쓰는 단계. 수거 → 배송 2단계다. */
export type RoundStage = 'COLLECT' | 'DELIVER';

export const METHOD_LABEL: Record<CleaningMethod, string> = {
  SEQUENTIAL: '순차',
  ROUND: '왕복',
};
export const ROUND_STAGE_LABEL: Record<RoundStage, string> = {
  COLLECT: '수거',
  DELIVER: '배송',
};

export interface Reservation {
  readonly id: string;
  readonly customerName: string;
  readonly address: string;
  readonly zoneId: string;
  readonly position: { lat: number; lng: number };
  readonly bikeId: string;
  readonly cleanerName: string;
  readonly method: CleaningMethod;
  /** 예정 시각(epoch ms). 이 값이 순서를 정한다. */
  readonly scheduledAt: number;
  readonly estimatedMinutes: number;
  /** 실제 도착. null 이면 아직 도착 전이다. */
  readonly arrivedAt: number | null;
  readonly completedAt: number | null;
  readonly status: ReservationStatus;
  readonly roundStage: RoundStage | null;
  /** 고객 알림 발송 시각. 사내 사이트 알람이다. 카카오는 후속. */
  readonly notifiedAt: number | null;
  readonly memo: string;
}

export interface CleaningState {
  readonly reservations: readonly Reservation[];
  readonly lastMessage: { kind: 'ok' | 'rejected'; text: string } | null;
}

const MINUTE = 60_000;

/** 오늘 특정 시각(HH:MM)의 epoch ms. 사용자가 입력한 시각을 해석할 때 쓴다. */
function todayAt(hour: number, minute: number): number {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

/**
 * 시드는 현재 시각 기준으로 만든다.
 *
 * 절대 시각(12:00, 17:00 …)으로 두면 실행 시각에 따라 상태가 달라진다.
 * 오후 늦게 열면 미래 예약이 하나도 없어 "예약" 상태를 볼 수 없고,
 * 모든 건이 지연으로 잡힌다. 언제 열어도 완료·진행·지연·예약이 모두
 * 보여야 QA 를 할 수 있다.
 */
function fromNow(minutes: number): number {
  return Date.now() + minutes * MINUTE;
}

function seed(): Reservation[] {
  return [
    {
      id: 'res-1',
      customerName: '잠실 어린이집',
      address: '서울 송파구 잠실동 40',
      zoneId: 'songpa',
      position: { lat: 37.5133, lng: 127.1 },
      bikeId: 'bike-4',
      cleanerName: '박지호',
      method: 'SEQUENTIAL',
      // 완료 — 예정보다 2분 늦게 도착해 40분 걸렸다.
      scheduledAt: fromNow(-150),
      estimatedMinutes: 40,
      arrivedAt: fromNow(-148),
      completedAt: fromNow(-108),
      status: 'DONE',
      roundStage: null,
      notifiedAt: fromNow(-180),
      memo: '',
    },
    {
      id: 'res-2',
      customerName: '가락 유치원',
      address: '서울 송파구 가락동 231',
      zoneId: 'songpa',
      position: { lat: 37.4952, lng: 127.1257 },
      bikeId: 'bike-4',
      cleanerName: '최유진',
      method: 'SEQUENTIAL',
      // 진행 중 — 18분 늦게 도착했다.
      scheduledAt: fromNow(-45),
      estimatedMinutes: 45,
      arrivedAt: fromNow(-27),
      completedAt: null,
      status: 'ACTIVE',
      roundStage: null,
      notifiedAt: fromNow(-75),
      memo: '',
    },
    {
      id: 'res-3',
      customerName: '합정 스튜디오',
      address: '서울 마포구 합정동 21',
      zoneId: 'mapo',
      position: { lat: 37.5489, lng: 126.9138 },
      bikeId: 'bike-5',
      cleanerName: '한소희',
      method: 'ROUND',
      // 왕복 수거 진행 중.
      scheduledAt: fromNow(-30),
      estimatedMinutes: 90,
      arrivedAt: fromNow(-25),
      completedAt: null,
      status: 'ACTIVE',
      roundStage: 'COLLECT',
      notifiedAt: fromNow(-60),
      memo: '유모차 5대 수거',
    },
    {
      id: 'res-4',
      customerName: '문정 카페',
      address: '서울 송파구 문정동 55',
      zoneId: 'songpa',
      position: { lat: 37.4852, lng: 127.1218 },
      bikeId: 'bike-4',
      cleanerName: '최유진',
      method: 'SEQUENTIAL',
      // 미래 예약 — 아직 시각이 오지 않았다.
      scheduledAt: fromNow(95),
      estimatedMinutes: 40,
      arrivedAt: null,
      completedAt: null,
      status: 'RESERVED',
      roundStage: null,
      notifiedAt: null,
      memo: '',
    },
    {
      id: 'res-5',
      customerName: '망원 공방',
      address: '서울 마포구 망원동 4',
      zoneId: 'mapo',
      position: { lat: 37.5561, lng: 126.9012 },
      bikeId: 'bike-5',
      cleanerName: '한소희',
      method: 'SEQUENTIAL',
      // 지연 — 예정 시각이 25분 지났는데 도착하지 않았다.
      scheduledAt: fromNow(-25),
      estimatedMinutes: 35,
      arrivedAt: null,
      completedAt: null,
      status: 'RESERVED',
      roundStage: null,
      notifiedAt: fromNow(-55),
      memo: '',
    },
  ];
}

/**
 * 클리닝 차량. 예약용 최소 정보다.
 * 차량·인력의 정본은 fleet-store 이고 여기 값은 그것과 맞춰 둔다 —
 * 한 사람이 라이더와 클리너를 동시에 할 수 없으므로(직무는 배타적) 배송
 * 라이더와 이름이 겹치지 않아야 한다.
 */
export const CLEANING_FLEET: ReadonlyArray<{
  bikeId: string;
  plateNumber: string;
  cleanerName: string;
  zoneId: string;
}> = [
  { bikeId: 'bike-4', plateNumber: '56다 1122', cleanerName: '최유진', zoneId: 'songpa' },
  { bikeId: 'bike-5', plateNumber: '90마 3344', cleanerName: '한소희', zoneId: 'mapo' },
  { bikeId: 'bike-6', plateNumber: '12나 5566', cleanerName: '박지호', zoneId: 'gangnam' },
];

let state: CleaningState = { reservations: seed(), lastMessage: null };
const listeners = new Set<() => void>();
let sequence = 100;

function emit(next: CleaningState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeCleaning(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCleaningSnapshot(): CleaningState {
  return state;
}

// ---------- 조회 ----------

/**
 * 예정 시각순으로 정렬한다. 이것이 방문 순서다.
 * 같은 시각이면 등록 순(id)으로 tie-break 한다 (§7.2).
 */
export function bySchedule(reservations: readonly Reservation[]): readonly Reservation[] {
  return reservations
    .slice()
    .sort((a, b) => a.scheduledAt - b.scheduledAt || a.id.localeCompare(b.id));
}

export function reservationsOfBike(
  reservations: readonly Reservation[],
  bikeId: string,
): readonly Reservation[] {
  return bySchedule(reservations.filter((entry) => entry.bikeId === bikeId));
}

/** 그 차량 안에서 몇 번째 방문인지. 예정 시각 정렬 결과이므로 읽기 전용이다. */
export function visitOrder(reservations: readonly Reservation[], target: Reservation): number {
  return reservationsOfBike(reservations, target.bikeId).findIndex((e) => e.id === target.id) + 1;
}

/** 예정 대비 편차(분). 도착 전이면 현재 시각 기준 지연, 도착 후면 실제 편차. */
export function deviationMinutes(reservation: Reservation, now: number): number {
  const reference = reservation.arrivedAt ?? now;
  return Math.round((reference - reservation.scheduledAt) / MINUTE);
}

/** 지연 여부. 도착 전인데 예정 시각을 넘겼으면 지연이다. */
export function isDelayed(reservation: Reservation, now: number, toleranceMinutes = 5): boolean {
  if (reservation.status === 'DONE') return false;
  if (reservation.arrivedAt !== null) return false;
  return now - reservation.scheduledAt > toleranceMinutes * MINUTE;
}

export function serviceMinutes(reservation: Reservation): number | null {
  if (reservation.arrivedAt === null || reservation.completedAt === null) return null;
  return Math.max(0, Math.round((reservation.completedAt - reservation.arrivedAt) / MINUTE));
}

export interface TimeConflict {
  readonly withId: string;
  readonly text: string;
}

/**
 * 같은 차량의 시간 구간이 겹치는지. [예정, 예정 + 예상 소요) 로 본다.
 * 차단하지 않고 경고한다 — 현장에서 겹치게 넣어야 하는 경우가 있다 (§7.3).
 */
export function findConflicts(
  reservations: readonly Reservation[],
  candidate: { bikeId: string; scheduledAt: number; estimatedMinutes: number; id?: string },
): readonly TimeConflict[] {
  const start = candidate.scheduledAt;
  const end = start + candidate.estimatedMinutes * MINUTE;
  return reservations
    .filter(
      (entry) =>
        entry.bikeId === candidate.bikeId &&
        entry.id !== candidate.id &&
        entry.status !== 'DONE',
    )
    .filter((entry) => {
      const entryStart = entry.scheduledAt;
      const entryEnd = entryStart + entry.estimatedMinutes * MINUTE;
      return start < entryEnd && entryStart < end;
    })
    .map((entry) => ({
      withId: entry.id,
      text: `${clockOf(entry.scheduledAt)} ${entry.address} (${entry.estimatedMinutes}분) 과 겹칩니다.`,
    }));
}

export function clockOf(value: number | null): string {
  if (value === null) return '—';
  return new Date(value).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export interface PunctualityStats {
  readonly sampleCount: number;
  /** 정시율(%). 허용 오차 이내 도착 비율. */
  readonly onTimeRate: number;
  readonly averageDeviation: number;
  readonly maxDelay: number;
  readonly averageServiceMinutes: number;
}

/** 시각 준수 지표. 클리닝 고유 지표다 (§9). */
export function punctualityStats(
  reservations: readonly Reservation[],
  toleranceMinutes = 5,
): PunctualityStats {
  const arrived = reservations.filter((entry) => entry.arrivedAt !== null);
  if (arrived.length === 0) {
    return {
      sampleCount: 0,
      onTimeRate: 0,
      averageDeviation: 0,
      maxDelay: 0,
      averageServiceMinutes: 0,
    };
  }
  const deviations = arrived.map((entry) =>
    Math.round(((entry.arrivedAt ?? 0) - entry.scheduledAt) / MINUTE),
  );
  const services = arrived
    .map((entry) => serviceMinutes(entry))
    .filter((value): value is number => value !== null);
  return {
    sampleCount: arrived.length,
    onTimeRate: Math.round(
      (deviations.filter((value) => value <= toleranceMinutes).length / deviations.length) * 100,
    ),
    averageDeviation: Math.round(
      deviations.reduce((sum, value) => sum + value, 0) / deviations.length,
    ),
    maxDelay: Math.max(0, ...deviations),
    averageServiceMinutes:
      services.length === 0
        ? 0
        : Math.round(services.reduce((sum, value) => sum + value, 0) / services.length),
  };
}

// ---------- 동작 ----------

export interface StopInput {
  readonly time: string;
  readonly estimatedMinutes: number;
  readonly address: string;
}

/**
 * 순차 등록. 지점 여러 개를 한 번에 등록한다.
 * 순서는 입력 순이 아니라 **예정 시각순**으로 정해진다.
 */
export function registerSequential(input: {
  bikeId: string;
  customerName: string;
  zoneId: string;
  notify: boolean;
  stops: readonly StopInput[];
}): void {
  const valid = input.stops.filter((stop) => stop.address.trim() && stop.time);
  if (valid.length === 0) {
    emit({
      ...state,
      lastMessage: { kind: 'rejected', text: '시각과 주소가 있는 지점이 하나도 없습니다.' },
    });
    return;
  }

  const bike = CLEANING_FLEET.find((entry) => entry.bikeId === input.bikeId);
  const zone = ZONES.find((entry) => entry.id === input.zoneId) ?? ZONES[0];
  const now = Date.now();
  const created: Reservation[] = valid.map((stop) => {
    const [hour, minute] = stop.time.split(':').map((part) => Number.parseInt(part, 10));
    sequence += 1;
    return {
      id: `res-${sequence}`,
      customerName: input.customerName.trim() || '이름 없음',
      address: stop.address.trim(),
      zoneId: zone.id,
      position: {
        lat: zone.center.lat + (Math.random() - 0.5) * 0.03,
        lng: zone.center.lng + (Math.random() - 0.5) * 0.03,
      },
      bikeId: input.bikeId,
      cleanerName: bike?.cleanerName ?? '미배정',
      method: 'SEQUENTIAL',
      scheduledAt: todayAt(hour, minute),
      estimatedMinutes: stop.estimatedMinutes,
      arrivedAt: null,
      completedAt: null,
      status: 'RESERVED',
      roundStage: null,
      notifiedAt: input.notify ? now : null,
      memo: '',
    };
  });

  emit({
    reservations: [...state.reservations, ...created],
    lastMessage: {
      kind: 'ok',
      text: `${created.length}개 지점을 예약했습니다. 예정 시각순으로 방문 순서가 정해집니다.`,
    },
  });
}

export function markArrived(id: string): void {
  const target = state.reservations.find((entry) => entry.id === id);
  if (!target || target.arrivedAt !== null) {
    emit({ ...state, lastMessage: { kind: 'rejected', text: '이미 도착 처리된 예약입니다.' } });
    return;
  }
  const now = Date.now();
  const deviation = Math.round((now - target.scheduledAt) / MINUTE);
  emit({
    reservations: state.reservations.map((entry) =>
      entry.id === id ? { ...entry, arrivedAt: now, status: 'ACTIVE' } : entry,
    ),
    lastMessage: {
      kind: 'ok',
      text: `${target.address} 도착 처리. 예정 ${clockOf(target.scheduledAt)} 대비 ${
        deviation >= 0 ? `+${deviation}` : deviation
      }분입니다.`,
    },
  });
}

export function completeReservation(id: string): void {
  const target = state.reservations.find((entry) => entry.id === id);
  if (!target || target.arrivedAt === null) {
    emit({
      ...state,
      lastMessage: { kind: 'rejected', text: '도착 처리된 예약만 완료할 수 있습니다.' },
    });
    return;
  }
  // 왕복은 수거 → 배송 2단계다. 수거 완료는 배송 단계로 넘긴다.
  if (target.method === 'ROUND' && target.roundStage === 'COLLECT') {
    emit({
      reservations: state.reservations.map((entry) =>
        entry.id === id ? { ...entry, roundStage: 'DELIVER', arrivedAt: null, status: 'RESERVED' } : entry,
      ),
      lastMessage: { kind: 'ok', text: `${target.address} 수거를 마쳤습니다. 배송 단계로 넘어갑니다.` },
    });
    return;
  }
  emit({
    reservations: state.reservations.map((entry) =>
      entry.id === id ? { ...entry, completedAt: Date.now(), status: 'DONE' } : entry,
    ),
    lastMessage: { kind: 'ok', text: `${target.address} 서비스를 완료했습니다.` },
  });
}

/** 지연 전파 시 이후 예약 시각을 미룬다. 운영자가 손으로 조정한다 (§7.1 미결). */
export function shiftSchedule(id: string, minutes: number): void {
  const target = state.reservations.find((entry) => entry.id === id);
  if (!target) return;
  emit({
    reservations: state.reservations.map((entry) =>
      entry.id === id ? { ...entry, scheduledAt: entry.scheduledAt + minutes * MINUTE } : entry,
    ),
    lastMessage: {
      kind: 'ok',
      text: `${target.address} 예정 시각을 ${minutes}분 미뤘습니다. 순서가 다시 정렬됩니다.`,
    },
  });
}

export function notifyCustomer(id: string): void {
  const target = state.reservations.find((entry) => entry.id === id);
  if (!target) return;
  emit({
    reservations: state.reservations.map((entry) =>
      entry.id === id ? { ...entry, notifiedAt: Date.now() } : entry,
    ),
    lastMessage: {
      kind: 'ok',
      text: `${target.customerName} 에게 사이트 알람을 보냈습니다. 카카오 알림톡은 후속 범위입니다.`,
    },
  });
}

export function clearCleaningMessage(): void {
  if (state.lastMessage === null) return;
  emit({ ...state, lastMessage: null });
}
