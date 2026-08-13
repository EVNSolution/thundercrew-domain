import type { Order } from './order-store';
import type { Reservation } from './cleaning-store';
import type { Contract, Rider, Vehicle } from './fleet-store';
import { PURPOSE_LABEL } from './fleet-store';
import { itemsForVehicle, type MaintenanceItem, type MaintenanceRecord } from './maintenance-store';

/**
 * 진단 mock 데이터.
 *
 * 무결성 점검은 **고정 목록이 아니라 실제로 스토어를 훑어서 계산한다.** 점검
 * 결과를 시드로 박아두면 QA 가 데이터를 망가뜨려도 "정상"이 나오고, 반대로
 * 고쳐도 "실패"가 남는다. 그러면 이 화면은 아무것도 진단하지 않는 장식이 된다.
 *
 * 단말 동기화·수집 오류·재시동 알림은 외부에서 들어오는 기록이라 시드로 둔다.
 *
 * 기준: docs/frontend/03-screen-feature-map.md §14
 */

const MINUTE = 60_000;

function minutesAgo(minutes: number): number {
  return Date.now() - minutes * MINUTE;
}

export type CheckSeverity = 'OK' | 'WARN' | 'FAIL';

export interface ReferenceCheck {
  readonly id: string;
  readonly name: string;
  /** 무엇을 보는 점검인지 한 줄. */
  readonly detail: string;
  readonly severity: CheckSeverity;
  /** 걸린 항목. 비어 있으면 통과다. */
  readonly findings: readonly string[];
}

export interface IntegrityInput {
  readonly vehicles: readonly Vehicle[];
  readonly riders: readonly Rider[];
  readonly contracts: readonly Contract[];
  readonly orders: readonly Order[];
  readonly reservations: readonly Reservation[];
  readonly items: readonly MaintenanceItem[];
  readonly records: readonly MaintenanceRecord[];
}

/**
 * 참조 정합성 스캔.
 *
 * FAIL 과 WARN 을 구분한다. 없는 차량을 가리키는 주문은 고장(FAIL)이지만,
 * 함체가 없는 배송용 차량은 등록 순서상 잠시 그럴 수 있다(WARN). 둘을 같은
 * 색으로 칠하면 운영자가 급한 것을 골라낼 수 없다.
 */
export function referenceChecks(input: IntegrityInput): readonly ReferenceCheck[] {
  const vehicleById = new Map(input.vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const riderById = new Map(input.riders.map((rider) => [rider.id, rider]));
  const itemById = new Map(input.items.map((item) => [item.id, item]));

  const checks: ReferenceCheck[] = [];

  const push = (
    id: string,
    name: string,
    detail: string,
    findings: readonly string[],
    failSeverity: CheckSeverity,
  ) => {
    checks.push({
      id,
      name,
      detail,
      severity: findings.length === 0 ? 'OK' : failSeverity,
      findings,
    });
  };

  // 1. 주문이 가리키는 차량이 실제로 있는가.
  push(
    'order-vehicle',
    '주문 → 차량 참조',
    '배정된 주문의 차량이 자산에 있는지 확인합니다.',
    input.orders
      .filter((order) => order.assignedBikeId !== null && !vehicleById.has(order.assignedBikeId))
      .map((order) => `${order.address} → ${order.assignedBikeId} (없는 차량)`),
    'FAIL',
  );

  // 2. 용도 축 위반. 배송 주문이 클린차량에 붙어 있으면 두 축이 섞였다는 뜻이다.
  push(
    'order-purpose',
    '주문 → 용도 정합',
    '배송 주문이 배송용 차량에 배정됐는지 확인합니다.',
    input.orders
      .filter((order) => {
        if (order.assignedBikeId === null) return false;
        const vehicle = vehicleById.get(order.assignedBikeId);
        return vehicle !== undefined && vehicle.purpose !== 'DELIVERY';
      })
      .map((order) => {
        const vehicle = vehicleById.get(order.assignedBikeId ?? '');
        return `${order.address} → ${vehicle?.plateNumber} (${PURPOSE_LABEL[vehicle?.purpose ?? 'DELIVERY']})`;
      }),
    'FAIL',
  );

  // 3. 클리닝 예약이 클린차량에 붙어 있는가.
  push(
    'reservation-purpose',
    '예약 → 용도 정합',
    '클리닝 예약이 클린차량에 배정됐는지 확인합니다.',
    input.reservations
      .filter((reservation) => {
        const vehicle = vehicleById.get(reservation.bikeId);
        return vehicle !== undefined && vehicle.purpose !== 'CLEANING';
      })
      .map((reservation) => {
        const vehicle = vehicleById.get(reservation.bikeId);
        return `${reservation.address} → ${vehicle?.plateNumber} (${PURPOSE_LABEL[vehicle?.purpose ?? 'CLEANING']})`;
      }),
    'FAIL',
  );

  // 4. 계약이 가리키는 차량·인력이 있는가.
  push(
    'contract-refs',
    '계약 → 차량·인력 참조',
    '계약의 차량과 인력이 자산에 있는지 확인합니다.',
    input.contracts
      .filter(
        (contract) => !vehicleById.has(contract.bikeId) || !riderById.has(contract.riderId),
      )
      .map((contract) => `${contract.templateName} (${contract.bikeId} / ${contract.riderId})`),
    'FAIL',
  );

  // 5. 인수방식 축. 배송용 계약은 인수/반납, 클리닝 계약은 직영/협력을 가진다.
  push(
    'contract-axis',
    '계약 → 인수방식 축',
    '용도에 맞는 인수방식 축이 채워졌는지 확인합니다.',
    input.contracts
      .filter((contract) => {
        const vehicle = vehicleById.get(contract.bikeId);
        if (!vehicle) return false;
        return vehicle.purpose === 'DELIVERY'
          ? contract.returnType === null
          : contract.operationType === null;
      })
      .map((contract) => {
        const vehicle = vehicleById.get(contract.bikeId);
        return `${contract.templateName} (${PURPOSE_LABEL[vehicle?.purpose ?? 'DELIVERY']} 인데 축이 비었습니다)`;
      }),
    'FAIL',
  );

  // 6. 정비 기록이 가리키는 차량·품목이 있는가.
  push(
    'maintenance-refs',
    '정비 기록 → 차량·품목 참조',
    '정비 기록의 차량과 품목이 있는지 확인합니다.',
    input.records
      .filter((record) => !vehicleById.has(record.bikeId) || !itemById.has(record.itemId))
      .map((record) => `${record.id} (${record.bikeId} / ${record.itemId})`),
    'FAIL',
  );

  // 7. 어느 분류에도 속하지 않는 품목은 어떤 차량에도 뜨지 않는다 — 사실상 죽은 품목이다.
  push(
    'item-categories',
    '정비 품목 → 적용 분류',
    '적용 분류가 하나도 없는 품목을 찾습니다.',
    input.items
      .filter((item) => item.enabled && item.categories.length === 0)
      .map((item) => `${item.name} (분류 0개 — 어떤 차량에도 뜨지 않습니다)`),
    'FAIL',
  );

  // 8. 단말 UID 중복. 두 차량이 같은 단말을 가리키면 텔레메트리가 섞인다.
  const uidCount = new Map<string, string[]>();
  for (const vehicle of input.vehicles) {
    if (vehicle.deviceUid === null) continue;
    const list = uidCount.get(vehicle.deviceUid) ?? [];
    list.push(vehicle.plateNumber);
    uidCount.set(vehicle.deviceUid, list);
  }
  push(
    'device-uid',
    '단말 UID 중복',
    '두 차량이 같은 단말을 가리키는지 확인합니다.',
    [...uidCount.entries()]
      .filter(([, plates]) => plates.length > 1)
      .map(([uid, plates]) => `${uid} → ${plates.join(', ')}`),
    'FAIL',
  );

  // 9. 동시 1건 규칙. 스토어가 막지만 검증은 따로 돈다 — 막는 코드와 확인하는
  //    코드가 같으면 그 코드가 틀렸을 때 아무도 알 수 없다.
  const heldCount = new Map<string, number>();
  for (const order of input.orders) {
    if (order.status !== 'ASSIGNED' || order.assignedBikeId === null) continue;
    heldCount.set(order.assignedBikeId, (heldCount.get(order.assignedBikeId) ?? 0) + 1);
  }
  push(
    'concurrent-orders',
    '동시 배차 1건 규칙',
    '한 배송원이 2건 이상 잡고 있는지 확인합니다.',
    [...heldCount.entries()]
      .filter(([, count]) => count > 1)
      .map(([bikeId, count]) => `${vehicleById.get(bikeId)?.plateNumber ?? bikeId} — ${count}건`),
    'FAIL',
  );

  // 10. 배송용인데 함체가 없다. 등록 직후라면 정상일 수 있어 경고로 둔다.
  push(
    'delivery-box',
    '배송용 차량 함체',
    '배송용 차량에 함체가 장착됐는지 확인합니다.',
    input.vehicles
      .filter(
        (vehicle) =>
          vehicle.purpose === 'DELIVERY' &&
          !vehicle.equipment.some((item) => item.typeName === '함체'),
      )
      .map((vehicle) => `${vehicle.plateNumber} (함체 없음)`),
    'WARN',
  );

  // 11. 해당 품목이 하나도 없는 차량. 6분류 조합이 비어 있다는 뜻이다.
  push(
    'vehicle-items',
    '차량 → 정비 품목',
    '정비 품목이 하나도 붙지 않는 차량을 찾습니다.',
    input.vehicles
      .filter((vehicle) => itemsForVehicle(vehicle, input.items).length === 0)
      .map((vehicle) => `${vehicle.plateNumber} (해당 품목 0개)`),
    'WARN',
  );

  return checks;
}

export function worstSeverity(checks: readonly ReferenceCheck[]): CheckSeverity {
  if (checks.some((check) => check.severity === 'FAIL')) return 'FAIL';
  if (checks.some((check) => check.severity === 'WARN')) return 'WARN';
  return 'OK';
}

// ---------- 외부에서 들어오는 기록 (시드) ----------

export interface TelemetrySignal {
  readonly bikeId: string;
  /** 마지막 수신 시각. */
  readonly lastSeenAt: number;
}

/**
 * 차량별 마지막 텔레메트리 수신 시각.
 *
 * 미수신 판정은 이 값과 설정의 임계를 비교해서 계산한다. "미수신 차량 목록"을
 * 시드로 박아두면 설정에서 임계를 바꿔도 목록이 그대로여서 설정이 거짓이 된다.
 */
export const TELEMETRY_SIGNALS: readonly TelemetrySignal[] = [
  { bikeId: 'bike-1', lastSeenAt: minutesAgo(1) },
  { bikeId: 'bike-2', lastSeenAt: minutesAgo(2) },
  // 임계(기본 15분)를 넘긴 차량. 관제에서도 미수신으로 표시된다.
  { bikeId: 'bike-3', lastSeenAt: minutesAgo(47) },
  { bikeId: 'bike-4', lastSeenAt: minutesAgo(4) },
  { bikeId: 'bike-5', lastSeenAt: minutesAgo(21) },
  { bikeId: 'bike-6', lastSeenAt: minutesAgo(3) },
];

export interface DeviceSyncLog {
  readonly id: string;
  readonly at: number;
  readonly endpoint: string;
  readonly ok: boolean;
  /** 처리 건수. */
  readonly count: number;
  readonly message: string;
}

export const DEVICE_SYNC_LOGS: readonly DeviceSyncLog[] = [
  { id: 'ds-1', at: minutesAgo(3), endpoint: 'observer/events', ok: true, count: 214, message: '정상' },
  { id: 'ds-2', at: minutesAgo(8), endpoint: 'observer/events', ok: true, count: 198, message: '정상' },
  {
    id: 'ds-3',
    at: minutesAgo(13),
    endpoint: 'observer/events',
    ok: false,
    count: 0,
    message: '504 Gateway Timeout — 재시도 1회 후 성공',
  },
  { id: 'ds-4', at: minutesAgo(18), endpoint: 'observer/devices', ok: true, count: 6, message: '정상' },
  {
    id: 'ds-5',
    at: minutesAgo(44),
    endpoint: 'observer/events',
    ok: false,
    count: 0,
    message: '401 Unauthorized — 키 회전 직후',
  },
  { id: 'ds-6', at: minutesAgo(63), endpoint: 'observer/events', ok: true, count: 231, message: '정상' },
];

export type IngestionStage = 'RECEIVE' | 'PARSE' | 'PERSIST';

export const STAGE_LABEL: Record<IngestionStage, string> = {
  RECEIVE: '수신',
  PARSE: '해석',
  PERSIST: '저장',
};

export interface IngestionErrorLog {
  readonly id: string;
  readonly at: number;
  readonly bikeId: string;
  readonly stage: IngestionStage;
  readonly reason: string;
}

export const INGESTION_ERRORS: readonly IngestionErrorLog[] = [
  { id: 'ie-1', at: minutesAgo(11), bikeId: 'bike-3', stage: 'RECEIVE', reason: '연결 없음 (단말 무응답)' },
  { id: 'ie-2', at: minutesAgo(26), bikeId: 'bike-3', stage: 'RECEIVE', reason: '연결 없음 (단말 무응답)' },
  { id: 'ie-3', at: minutesAgo(34), bikeId: 'bike-5', stage: 'PARSE', reason: '좌표 필드 누락' },
  { id: 'ie-4', at: minutesAgo(58), bikeId: 'bike-2', stage: 'PERSIST', reason: '중복 타임스탬프 — 무시' },
  { id: 'ie-5', at: minutesAgo(92), bikeId: 'bike-5', stage: 'PARSE', reason: '배터리 값 범위 초과 (128%)' },
];

export interface ReignitionNotification {
  readonly id: string;
  readonly at: number;
  readonly bikeId: string;
  /** 운영자가 확인한 시각. null 이면 미확인이다. */
  readonly acknowledgedAt: number | null;
  readonly acknowledgedBy: string | null;
}

export const REIGNITION_NOTIFICATIONS: readonly ReignitionNotification[] = [
  { id: 'rn-1', at: minutesAgo(9), bikeId: 'bike-2', acknowledgedAt: null, acknowledgedBy: null },
  { id: 'rn-2', at: minutesAgo(37), bikeId: 'bike-1', acknowledgedAt: minutesAgo(31), acknowledgedBy: '박관제' },
  { id: 'rn-3', at: minutesAgo(88), bikeId: 'bike-4', acknowledgedAt: minutesAgo(80), acknowledgedBy: '박관제' },
  { id: 'rn-4', at: minutesAgo(150), bikeId: 'bike-2', acknowledgedAt: minutesAgo(149), acknowledgedBy: '김운영' },
];
