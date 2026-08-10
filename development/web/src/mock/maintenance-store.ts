import { getFleetSnapshot, type EngineType, type Vehicle, type WheelType } from './fleet-store';

/**
 * 정비 mock 스토어.
 *
 * 정비는 용도와 무관하다. 정비 품목은 `(wheelType, engineType)` 조합으로
 * 결정되므로 브레이크 패드는 배송용이든 클린차량이든 같은 품목이다.
 * 그래서 정비가 별도 진입 모드다 (02-design-system.md §5.2).
 *
 * 260804 미팅으로 LPG 가 추가되어 분류가 4개에서 **6개**가 됐다.
 *
 * 기준: docs/frontend/03-screen-feature-map.md §10~12
 */

export type MaintenanceCategory =
  | 'TWO_WHEEL_ELECTRIC'
  | 'TWO_WHEEL_ICE'
  | 'TWO_WHEEL_LPG'
  | 'FOUR_WHEEL_ELECTRIC'
  | 'FOUR_WHEEL_ICE'
  | 'FOUR_WHEEL_LPG';

export const ALL_CATEGORIES: readonly MaintenanceCategory[] = [
  'TWO_WHEEL_ELECTRIC',
  'TWO_WHEEL_ICE',
  'TWO_WHEEL_LPG',
  'FOUR_WHEEL_ELECTRIC',
  'FOUR_WHEEL_ICE',
  'FOUR_WHEEL_LPG',
];

export const CATEGORY_LABEL: Record<MaintenanceCategory, string> = {
  TWO_WHEEL_ELECTRIC: '2륜 · 전기',
  TWO_WHEEL_ICE: '2륜 · 내연',
  TWO_WHEEL_LPG: '2륜 · LPG',
  FOUR_WHEEL_ELECTRIC: '4륜 · 전기',
  FOUR_WHEEL_ICE: '4륜 · 내연',
  FOUR_WHEEL_LPG: '4륜 · LPG',
};

/** 260804 미팅으로 새로 생긴 분류. 기존 품목의 재부여 검수가 필요하다 (§11.1). */
export const NEW_CATEGORIES: readonly MaintenanceCategory[] = ['TWO_WHEEL_LPG', 'FOUR_WHEEL_LPG'];

/** 차량의 정비 분류. 용도가 아니라 휠 × 엔진으로 결정된다. */
export function categoryOf(wheelType: WheelType, engineType: EngineType): MaintenanceCategory {
  const wheel = wheelType === 'TWO_WHEEL' ? 'TWO_WHEEL' : 'FOUR_WHEEL';
  return `${wheel}_${engineType}` as MaintenanceCategory;
}

export interface MaintenanceItem {
  readonly id: string;
  readonly name: string;
  /** 적용 분류. 한 품목이 여러 분류에 속할 수 있다. */
  readonly categories: readonly MaintenanceCategory[];
  readonly cycleKm: number | null;
  readonly cycleMonths: number | null;
  /** 이 비율을 넘으면 임박으로 본다. */
  readonly alertThresholdPercent: number;
  /**
   * 이 장비가 붙어 있는 차량에만 뜨는 품목. 함체 고정부 점검처럼
   * 장비에 딸린 정비다. null 이면 분류만 맞으면 뜬다.
   */
  readonly requiresEquipment: string | null;
  readonly enabled: boolean;
}

export interface MaintenanceRecord {
  readonly id: string;
  readonly bikeId: string;
  readonly itemId: string;
  readonly performedAt: number;
  readonly odometerKm: number;
  readonly actor: string;
}

export interface MaintenanceState {
  readonly items: readonly MaintenanceItem[];
  readonly records: readonly MaintenanceRecord[];
  readonly lastMessage: { kind: 'ok' | 'rejected'; text: string } | null;
}

const DAY = 86_400_000;

function daysAgo(days: number): number {
  return Date.now() - days * DAY;
}

function seedItems(): MaintenanceItem[] {
  return [
    {
      id: 'mi-1',
      name: '브레이크 패드 (앞)',
      // 동력과 무관한 품목은 6분류 전체에 속한다.
      categories: ALL_CATEGORIES,
      cycleKm: 5_000,
      cycleMonths: null,
      alertThresholdPercent: 85,
      requiresEquipment: null,
      enabled: true,
    },
    {
      id: 'mi-2',
      name: '타이어 (뒤)',
      categories: ['TWO_WHEEL_ELECTRIC', 'TWO_WHEEL_ICE', 'TWO_WHEEL_LPG'],
      cycleKm: 10_000,
      cycleMonths: null,
      alertThresholdPercent: 85,
      requiresEquipment: null,
      enabled: true,
    },
    {
      id: 'mi-3',
      name: '엔진오일',
      // 내연·LPG 만. 260804 로 LPG 2분류가 추가돼 4분류가 됐다.
      categories: ['TWO_WHEEL_ICE', 'TWO_WHEEL_LPG', 'FOUR_WHEEL_ICE', 'FOUR_WHEEL_LPG'],
      cycleKm: 10_000,
      cycleMonths: null,
      alertThresholdPercent: 85,
      requiresEquipment: null,
      enabled: true,
    },
    {
      id: 'mi-4',
      name: 'LPG 봄베 검사',
      categories: ['TWO_WHEEL_LPG', 'FOUR_WHEEL_LPG'],
      cycleKm: null,
      cycleMonths: 24,
      alertThresholdPercent: 90,
      requiresEquipment: null,
      enabled: true,
    },
    {
      id: 'mi-5',
      name: '감속기 오일',
      categories: ['TWO_WHEEL_ELECTRIC', 'FOUR_WHEEL_ELECTRIC'],
      cycleKm: null,
      cycleMonths: 12,
      alertThresholdPercent: 85,
      requiresEquipment: null,
      enabled: true,
    },
    {
      id: 'mi-6',
      name: '배터리 커넥터 점검',
      categories: ['TWO_WHEEL_ELECTRIC', 'FOUR_WHEEL_ELECTRIC'],
      cycleKm: null,
      cycleMonths: 6,
      alertThresholdPercent: 85,
      requiresEquipment: null,
      enabled: true,
    },
    {
      id: 'mi-7',
      name: '함체 고정부 점검',
      categories: ['TWO_WHEEL_ELECTRIC', 'TWO_WHEEL_ICE', 'TWO_WHEEL_LPG'],
      cycleKm: null,
      cycleMonths: 6,
      alertThresholdPercent: 85,
      // 함체가 붙어 있는 차량만. 배송용에만 함체가 있다.
      requiresEquipment: '함체',
      enabled: true,
    },
    {
      id: 'mi-8',
      name: '타이어 (4개)',
      categories: ['FOUR_WHEEL_ELECTRIC', 'FOUR_WHEEL_ICE', 'FOUR_WHEEL_LPG'],
      cycleKm: 40_000,
      cycleMonths: null,
      alertThresholdPercent: 85,
      requiresEquipment: null,
      enabled: true,
    },
  ];
}

/** 차량별 하루 주행량 (km). 시드 주행거리를 거꾸로 계산하는 데만 쓴다. */
const SEED_KM_PER_DAY: Record<string, number> = {
  'bike-1': 20,
  'bike-2': 35,
  'bike-3': 10,
  'bike-4': 25,
  'bike-5': 30,
  'bike-6': 22,
};

/**
 * `days` 일 전 그 차량의 주행거리.
 *
 * 시드에 주행거리를 손으로 적으면 안 된다. 오도미터는 줄어들지 않으므로
 * 이력을 날짜순으로 세워놨을 때 주행거리가 왔다갔다 하면 QA 는 그걸
 * 데이터 오류로 읽는다. 현재 주행거리에서 하루 주행량만큼 거꾸로 빼면
 * 그 모순이 생길 수 없다.
 */
function odoAt(bikeId: string, days: number): number {
  const current = getFleetSnapshot().vehicles.find((vehicle) => vehicle.id === bikeId);
  const perDay = SEED_KM_PER_DAY[bikeId] ?? 20;
  return Math.max(0, Math.round(((current?.odometerKm ?? 0) - perDay * days) / 10) * 10);
}

function seedRecords(): MaintenanceRecord[] {
  // 초과 3건 (bike-2 타이어, bike-5 엔진오일·LPG), 임박 2건 (bike-1·bike-6 감속기),
  // 미점검 1건 (bike-2 엔진오일 — 일부러 기록을 비워둔다). 네 상태가 모두 보여야 한다.
  return [
    { id: 'mr-1', bikeId: 'bike-1', itemId: 'mi-1', performedAt: daysAgo(13), odometerKm: odoAt('bike-1', 13), actor: '정비1팀 김수' },
    { id: 'mr-2', bikeId: 'bike-1', itemId: 'mi-2', performedAt: daysAgo(150), odometerKm: odoAt('bike-1', 150), actor: '정비1팀 김수' },
    { id: 'mr-3', bikeId: 'bike-1', itemId: 'mi-5', performedAt: daysAgo(330), odometerKm: odoAt('bike-1', 330), actor: '정비2팀 박민' },
    { id: 'mr-4', bikeId: 'bike-1', itemId: 'mi-6', performedAt: daysAgo(62), odometerKm: odoAt('bike-1', 62), actor: '정비2팀 박민' },
    { id: 'mr-5', bikeId: 'bike-1', itemId: 'mi-7', performedAt: daysAgo(95), odometerKm: odoAt('bike-1', 95), actor: '정비1팀 김수' },
    { id: 'mr-6', bikeId: 'bike-2', itemId: 'mi-1', performedAt: daysAgo(6), odometerKm: odoAt('bike-2', 6), actor: '정비1팀 김수' },
    { id: 'mr-7', bikeId: 'bike-2', itemId: 'mi-2', performedAt: daysAgo(300), odometerKm: odoAt('bike-2', 300), actor: '정비1팀 김수' },
    { id: 'mr-8', bikeId: 'bike-2', itemId: 'mi-7', performedAt: daysAgo(40), odometerKm: odoAt('bike-2', 40), actor: '정비2팀 박민' },
    { id: 'mr-9', bikeId: 'bike-3', itemId: 'mi-1', performedAt: daysAgo(11), odometerKm: odoAt('bike-3', 11), actor: '정비2팀 박민' },
    { id: 'mr-10', bikeId: 'bike-3', itemId: 'mi-2', performedAt: daysAgo(11), odometerKm: odoAt('bike-3', 11), actor: '정비2팀 박민' },
    { id: 'mr-11', bikeId: 'bike-3', itemId: 'mi-5', performedAt: daysAgo(70), odometerKm: odoAt('bike-3', 70), actor: '정비1팀 김수' },
    { id: 'mr-12', bikeId: 'bike-3', itemId: 'mi-6', performedAt: daysAgo(35), odometerKm: odoAt('bike-3', 35), actor: '정비1팀 김수' },
    { id: 'mr-13', bikeId: 'bike-4', itemId: 'mi-1', performedAt: daysAgo(25), odometerKm: odoAt('bike-4', 25), actor: '정비1팀 김수' },
    { id: 'mr-14', bikeId: 'bike-4', itemId: 'mi-3', performedAt: daysAgo(45), odometerKm: odoAt('bike-4', 45), actor: '정비1팀 김수' },
    { id: 'mr-15', bikeId: 'bike-4', itemId: 'mi-4', performedAt: daysAgo(180), odometerKm: odoAt('bike-4', 180), actor: '외부 검사소' },
    { id: 'mr-16', bikeId: 'bike-4', itemId: 'mi-8', performedAt: daysAgo(150), odometerKm: odoAt('bike-4', 150), actor: '정비2팀 박민' },
    { id: 'mr-17', bikeId: 'bike-5', itemId: 'mi-1', performedAt: daysAgo(9), odometerKm: odoAt('bike-5', 9), actor: '정비2팀 박민' },
    { id: 'mr-18', bikeId: 'bike-5', itemId: 'mi-3', performedAt: daysAgo(360), odometerKm: odoAt('bike-5', 360), actor: '정비1팀 김수' },
    { id: 'mr-19', bikeId: 'bike-5', itemId: 'mi-4', performedAt: daysAgo(790), odometerKm: odoAt('bike-5', 790), actor: '외부 검사소' },
    { id: 'mr-20', bikeId: 'bike-5', itemId: 'mi-8', performedAt: daysAgo(120), odometerKm: odoAt('bike-5', 120), actor: '정비2팀 박민' },
    { id: 'mr-21', bikeId: 'bike-6', itemId: 'mi-1', performedAt: daysAgo(18), odometerKm: odoAt('bike-6', 18), actor: '정비1팀 김수' },
    { id: 'mr-22', bikeId: 'bike-6', itemId: 'mi-2', performedAt: daysAgo(60), odometerKm: odoAt('bike-6', 60), actor: '정비1팀 김수' },
    { id: 'mr-23', bikeId: 'bike-6', itemId: 'mi-5', performedAt: daysAgo(340), odometerKm: odoAt('bike-6', 340), actor: '정비2팀 박민' },
    { id: 'mr-24', bikeId: 'bike-6', itemId: 'mi-6', performedAt: daysAgo(50), odometerKm: odoAt('bike-6', 50), actor: '정비2팀 박민' },
  ];
}

let state: MaintenanceState = { items: seedItems(), records: seedRecords(), lastMessage: null };
const listeners = new Set<() => void>();
let sequence = 100;

function emit(next: MaintenanceState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeMaintenance(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMaintenanceSnapshot(): MaintenanceState {
  return state;
}

// ---------- 주기 판정 ----------

/**
 * 주기 상태.
 *
 * UNKNOWN 을 따로 둔다. 점검 기록이 없다는 것은 "주기가 지났다" 가 아니라
 * "모른다" 다. 이걸 초과로 계산하면 신규 차량과 실제로 주기를 넘긴 차량이
 * 구분되지 않고 화면이 전부 빨갛게 된다.
 */
export type DueStatus = 'UNKNOWN' | 'OK' | 'SOON' | 'OVERDUE';

export const DUE_LABEL: Record<DueStatus, string> = {
  UNKNOWN: '미점검',
  OK: '정상',
  SOON: '임박',
  OVERDUE: '초과',
};

export interface DueInfo {
  readonly status: DueStatus;
  /** 주기 소진율(%). 100 을 넘으면 초과다. */
  readonly percent: number;
  /** 사람이 읽는 진행 설명. "8,420 / 10,000 km" 또는 "11개월 / 12개월". */
  readonly progress: string;
  readonly lastPerformedAt: number | null;
}

/**
 * 한 차량·품목의 주기 상태.
 *
 * km 과 개월을 둘 다 가진 품목은 **먼저 닿는 쪽**을 기준으로 한다.
 * 그렇게 해야 안전 쪽으로 판정된다 (§11.1 미결에 대한 잠정 결정).
 */
export function dueInfo(
  vehicle: Vehicle,
  item: MaintenanceItem,
  records: readonly MaintenanceRecord[],
): DueInfo {
  const own = records
    .filter((record) => record.bikeId === vehicle.id && record.itemId === item.id)
    .sort((a, b) => b.performedAt - a.performedAt);
  const last = own[0] ?? null;

  // 점검 기록이 없으면 판정하지 않는다. 기준선이 없으므로 알 수 없다.
  if (last === null) {
    return { status: 'UNKNOWN', percent: 0, progress: '점검 기록 없음', lastPerformedAt: null };
  }

  const candidates: Array<{ percent: number; progress: string }> = [];

  if (item.cycleKm !== null) {
    const base = last.odometerKm;
    const since = Math.max(0, vehicle.odometerKm - base);
    candidates.push({
      percent: (since / item.cycleKm) * 100,
      progress: `${since.toLocaleString('ko-KR')} / ${item.cycleKm.toLocaleString('ko-KR')} km`,
    });
  }

  if (item.cycleMonths !== null) {
    const months = Math.floor((Date.now() - last.performedAt) / (30 * DAY));
    candidates.push({
      percent: (months / item.cycleMonths) * 100,
      progress: `${months}개월 / ${item.cycleMonths}개월`,
    });
  }

  if (candidates.length === 0) {
    return { status: 'OK', percent: 0, progress: '주기 미설정', lastPerformedAt: last.performedAt };
  }

  // 먼저 닿는 쪽 = 소진율이 가장 높은 쪽.
  const worst = candidates.reduce((acc, entry) => (entry.percent > acc.percent ? entry : acc));
  const status: DueStatus =
    worst.percent >= 100 ? 'OVERDUE' : worst.percent >= item.alertThresholdPercent ? 'SOON' : 'OK';

  return {
    status,
    percent: Math.round(worst.percent),
    progress: worst.progress,
    lastPerformedAt: last.performedAt,
  };
}

/** 이 차량에 뜨는 품목. 분류가 맞고, 장비 조건이 있으면 그 장비가 붙어 있어야 한다. */
export function itemsForVehicle(
  vehicle: Vehicle,
  items: readonly MaintenanceItem[],
): readonly MaintenanceItem[] {
  const category = categoryOf(vehicle.wheelType, vehicle.engineType);
  return items.filter((item) => {
    if (!item.enabled) return false;
    if (!item.categories.includes(category)) return false;
    if (item.requiresEquipment === null) return true;
    return vehicle.equipment.some((entry) => entry.typeName === item.requiresEquipment);
  });
}

export interface VehicleDueSummary {
  readonly overdue: number;
  readonly soon: number;
  /** 점검 기록이 없어 판정할 수 없는 품목 수. 초과와 섞지 않는다. */
  readonly unknown: number;
  readonly total: number;
}

export function summarizeVehicle(
  vehicle: Vehicle,
  items: readonly MaintenanceItem[],
  records: readonly MaintenanceRecord[],
): VehicleDueSummary {
  const applicable = itemsForVehicle(vehicle, items);
  let overdue = 0;
  let soon = 0;
  let unknown = 0;
  for (const item of applicable) {
    const info = dueInfo(vehicle, item, records);
    if (info.status === 'OVERDUE') overdue += 1;
    else if (info.status === 'SOON') soon += 1;
    else if (info.status === 'UNKNOWN') unknown += 1;
  }
  return { overdue, soon, unknown, total: applicable.length };
}

/** 이 품목이 적용되는 차량 수. 품목 화면에서 영향 범위를 보여준다. */
export function vehicleCountForItem(
  item: MaintenanceItem,
  vehicles: readonly Vehicle[],
): number {
  return vehicles.filter((vehicle) => itemsForVehicle(vehicle, [item]).length > 0).length;
}

// ---------- 동작 ----------

/** 정비 체크. 기록을 새로 쌓는다. 주행거리와 담당자를 함께 받는다. */
export function recordMaintenance(input: {
  bikeId: string;
  itemId: string;
  odometerKm: number;
  actor: string;
  itemName: string;
}): void {
  if (!input.actor.trim()) {
    emit({ ...state, lastMessage: { kind: 'rejected', text: '담당자를 입력해야 기록할 수 있습니다.' } });
    return;
  }
  sequence += 1;
  emit({
    ...state,
    records: [
      ...state.records,
      {
        id: `mr-${sequence}`,
        bikeId: input.bikeId,
        itemId: input.itemId,
        performedAt: Date.now(),
        odometerKm: input.odometerKm,
        actor: input.actor.trim(),
      },
    ],
    lastMessage: { kind: 'ok', text: `${input.itemName} 정비를 기록했습니다.` },
  });
}

/**
 * 오입력 취소. 기록을 지우지 않고 취소 기록을 남기는 방식도 있었지만
 * (§10.2 미결), mock 에서는 마지막 기록을 되돌리는 쪽으로 둔다.
 * 감사 로그가 별도로 있으므로 삭제 사실은 그쪽에 남는다는 전제다.
 */
export function undoLastRecord(bikeId: string, itemId: string, itemName: string): void {
  const own = state.records
    .filter((record) => record.bikeId === bikeId && record.itemId === itemId)
    .sort((a, b) => b.performedAt - a.performedAt);
  if (own.length === 0) {
    emit({ ...state, lastMessage: { kind: 'rejected', text: '되돌릴 기록이 없습니다.' } });
    return;
  }
  emit({
    ...state,
    records: state.records.filter((record) => record.id !== own[0].id),
    lastMessage: { kind: 'ok', text: `${itemName} 마지막 기록을 되돌렸습니다.` },
  });
}

export function toggleItemCategory(itemId: string, category: MaintenanceCategory): void {
  const item = state.items.find((candidate) => candidate.id === itemId);
  if (!item) return;
  const next = item.categories.includes(category)
    ? item.categories.filter((entry) => entry !== category)
    : [...item.categories, category];
  emit({
    ...state,
    items: state.items.map((candidate) =>
      candidate.id === itemId ? { ...candidate, categories: next } : candidate,
    ),
    lastMessage: {
      kind: 'ok',
      text: `${item.name} 의 적용 분류를 ${next.length}개로 바꿨습니다.`,
    },
  });
}

export function updateItem(itemId: string, changes: Partial<MaintenanceItem>): void {
  const item = state.items.find((candidate) => candidate.id === itemId);
  if (!item) return;
  const { categories: _ignored, ...safe } = changes;
  emit({
    ...state,
    items: state.items.map((candidate) =>
      candidate.id === itemId ? { ...candidate, ...safe } : candidate,
    ),
    lastMessage: { kind: 'ok', text: `${item.name} 을 저장했습니다.` },
  });
}

export function clearMaintenanceMessage(): void {
  if (state.lastMessage === null) return;
  emit({ ...state, lastMessage: null });
}
