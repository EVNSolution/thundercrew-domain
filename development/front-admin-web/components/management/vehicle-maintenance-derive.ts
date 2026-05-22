import type {
  ServiceOpsMaintenanceItem,
  ServiceOpsVehicleMaintenanceRecord
} from "@/lib/services/service-ops-api";

/**
 * 차량 floating panel "정비 상태" 섹션의 한 줄에 필요한 derived 정보. catalog
 * 의 cycle 과 이력의 servicedAt 을 합쳐 다음 예정 / 임박 / 지연 같은 표시 단위
 * 를 한 곳에서 계산한다.
 *
 * **카운팅 정책**:
 * - cycle_months 가 잡힌 품목은 servicedAt + months 로 다음 예정 일자 계산.
 * - cycle_km 이 잡힌 품목은 V24 부터 들어온 텔레메트리 odometer 와 마지막 교환
 *   시점 odometer 를 비교해 ratio 계산. 텔레메트리가 오프라인이거나 마지막
 *   교환 시 odometer 미입력이면 UNKNOWN.
 * - cycle_label (자유 텍스트, 예: "12개월 이상") 만 있는 품목은 안내 텍스트 그대로
 *   노출하고 상태는 NONE.
 *
 * **상태 등급**:
 * - NEVER — 한 번도 교환된 적 없음 (등록 직후). UI: 회색 "기록 없음"
 * - HEALTHY — 다음 예정의 90% 이전
 * - DUE_SOON — 다음 예정의 90% ~ 100% 사이 (임박)
 * - OVERDUE — 다음 예정 지남 (지연)
 * - UNKNOWN — cycle 정보가 너무 비정형해서 derived 계산 불가
 */
export type MaintenanceStatus = "NEVER" | "HEALTHY" | "DUE_SOON" | "OVERDUE" | "UNKNOWN";

export type DerivedMaintenanceRow = {
  item: ServiceOpsMaintenanceItem;
  lastServicedAt: string | null;
  lastServicedAtOdometerKm: number | null;
  /** cycle_months 기반 다음 예정 (ISO). cycle 정보 부족 시 null. */
  nextDueAt: string | null;
  status: MaintenanceStatus;
};

const APPROACH_RATIO = 0.9;

/**
 * 텔레메트리 현재 상태에서 derive 가 보는 부분 — odometer 가 자동 분류에 충분히
 * 신뢰할만한 상태(online) 인지, 그리고 현재 누적 주행거리. 둘 다 채워져 있어야
 * cycle_km 자동 분류가 작동한다. null 이거나 connection 이 ONLINE 이 아니면
 * cycle_km 품목은 안전 모드로 UNKNOWN 처리.
 */
export type CurrentTelemetryForDerive = {
  odometerKm: number | null;
  /** backend 의 "ONLINE" | "SIGNAL_LOST" | "PARKED_OFFLINE_NORMAL" | "STALE_UNKNOWN". */
  connectionStatus: string | null;
};

export function deriveMaintenanceRows(
  items: ReadonlyArray<ServiceOpsMaintenanceItem>,
  records: ReadonlyArray<ServiceOpsVehicleMaintenanceRecord>,
  current: CurrentTelemetryForDerive | null = null,
  now: Date = new Date()
): DerivedMaintenanceRow[] {
  // itemId → 가장 최근 기록 (records 가 이미 servicedAt desc 정렬이라 first hit).
  const latestByItem = new Map<string, ServiceOpsVehicleMaintenanceRecord>();
  for (const record of records) {
    if (!latestByItem.has(record.itemId)) {
      latestByItem.set(record.itemId, record);
    }
  }

  // 자동 km 분류 가능 조건: 텔레메트리 ONLINE + odometer 수치 존재. 그 외엔
  // 마지막 알려진 odometer 가 stale 일 수 있어 cycle_km 자동 status 는 보류.
  const currentOdometerKm =
    current && current.connectionStatus === "ONLINE" && typeof current.odometerKm === "number"
      ? current.odometerKm
      : null;

  return items.map((item) => {
    const latest = latestByItem.get(item.id) ?? null;
    const lastServicedAt = latest?.servicedAt ?? null;
    const lastServicedAtOdometerKm = latest?.servicedAtOdometerKm ?? null;

    // 그룹 부모 (cycle 없음) — 항상 UNKNOWN, 자식이 실제 상태를 캐리.
    if (item.cycleKm === null && item.cycleMonths === null) {
      return {
        item,
        lastServicedAt,
        lastServicedAtOdometerKm,
        nextDueAt: null,
        status: "UNKNOWN"
      };
    }

    if (!lastServicedAt) {
      return {
        item,
        lastServicedAt: null,
        lastServicedAtOdometerKm,
        nextDueAt: nextDueAtFromCycle(null, item.cycleMonths),
        status: "NEVER"
      };
    }

    // cycle_months 기반 자동 계산 — 가장 confident 한 시간 단위.
    if (item.cycleMonths !== null) {
      const nextDueAt = nextDueAtFromCycle(lastServicedAt, item.cycleMonths);
      if (nextDueAt) {
        const status = classifyByDate(new Date(lastServicedAt), new Date(nextDueAt), now);
        return { item, lastServicedAt, lastServicedAtOdometerKm, nextDueAt, status };
      }
    }

    // cycle_km 자동 분류. 두 baseline (현재 odometer + 마지막 교환 odometer) 모두
    // 있어야 가능. lastServicedAtOdometerKm 가 null 이면 운영자가 교환 시점
    // odometer 를 안 적은 케이스 — 그 행만 UNKNOWN 처리하되 다른 행은 영향
    // 안 받음.
    if (
      item.cycleKm !== null &&
      currentOdometerKm !== null &&
      lastServicedAtOdometerKm !== null &&
      currentOdometerKm >= lastServicedAtOdometerKm
    ) {
      const status = classifyByKm(currentOdometerKm - lastServicedAtOdometerKm, item.cycleKm);
      return { item, lastServicedAt, lastServicedAtOdometerKm, nextDueAt: null, status };
    }

    return {
      item,
      lastServicedAt,
      lastServicedAtOdometerKm,
      nextDueAt: null,
      status: "UNKNOWN"
    };
  });
}

function classifyByKm(kmSinceService: number, cycleKm: number): MaintenanceStatus {
  if (cycleKm <= 0) return "UNKNOWN";
  const ratio = kmSinceService / cycleKm;
  if (ratio < APPROACH_RATIO) return "HEALTHY";
  if (ratio < 1) return "DUE_SOON";
  return "OVERDUE";
}

/**
 * 차량 한 대의 정비 상태 요약. 차량 탭 필터가 임박/지연 차량을 빠르게
 * 골라내기 위해 각 차량에 대해 한 번씩만 계산하고 캐싱.
 *
 * `hasOverdue` / `hasDueSoon` — 해당 차량의 어떤 품목이라도 그 상태면 true.
 * `overallStatus` — 우선순위 OVERDUE > DUE_SOON > HEALTHY > NEVER > UNKNOWN.
 */
export type VehicleMaintenanceSummary = {
  hasOverdue: boolean;
  hasDueSoon: boolean;
  overallStatus: MaintenanceStatus;
};

const STATUS_PRIORITY: Record<MaintenanceStatus, number> = {
  OVERDUE: 4,
  DUE_SOON: 3,
  HEALTHY: 2,
  NEVER: 1,
  UNKNOWN: 0
};

/**
 * bikeId → 그 차량의 정비 상태 요약 map. 전체 데이터셋(items + records) 와
 * engineType-별 catalog 매핑을 받아 한 번에 계산.
 *
 * `bikeEngineTypeById` — 차량 ID 가 ICE/ELECTRIC 중 어느 catalog 를 봐야 하는지.
 *   엔트리 없으면 ELECTRIC 으로 fallback (V21 default 정책과 일치).
 */
export function summarizeMaintenanceByBike(
  items: ReadonlyArray<ServiceOpsMaintenanceItem>,
  records: ReadonlyArray<ServiceOpsVehicleMaintenanceRecord>,
  bikeEngineTypeById: Map<string, "ELECTRIC" | "ICE">,
  now: Date = new Date()
): Map<string, VehicleMaintenanceSummary> {
  // engineType 별 적용 catalog 두 묶음 미리 분리.
  const electricItems = items.filter(
    (item) => item.appliesTo === "ELECTRIC" || item.appliesTo === "BOTH"
  );
  const iceItems = items.filter(
    (item) => item.appliesTo === "ICE" || item.appliesTo === "BOTH"
  );

  // bikeId → records 그룹핑.
  const recordsByBike = new Map<string, ServiceOpsVehicleMaintenanceRecord[]>();
  for (const record of records) {
    const list = recordsByBike.get(record.bikeId);
    if (list) list.push(record);
    else recordsByBike.set(record.bikeId, [record]);
  }

  // bikeEngineTypeById 에 등장한 모든 차량에 대해 요약 계산.
  const result = new Map<string, VehicleMaintenanceSummary>();
  for (const [bikeId, engineType] of bikeEngineTypeById) {
    const applicableItems = engineType === "ICE" ? iceItems : electricItems;
    const bikeRecords = recordsByBike.get(bikeId) ?? [];
    // 다음 단계에선 servicedAt desc 정렬 가정 — recordsByBike push 순서가
    // 백엔드 응답(이미 정렬됨) 그대로라 별도 정렬 안 함.
    // 표 필터 단의 요약은 텔레메트리 odometer 를 (아직) 가져오지 않는다 — cycle_km
    // 품목 자동 분류는 floating panel 안에서만. 표의 "임박/지연" 필터에 cycle_km
    // 도 끼우려면 차량 별 current state map 을 page-level 에 추가하면 됨.
    const rows = deriveMaintenanceRows(applicableItems, bikeRecords, null, now);
    let overall: MaintenanceStatus = "UNKNOWN";
    let hasOverdue = false;
    let hasDueSoon = false;
    for (const row of rows) {
      if (row.status === "OVERDUE") hasOverdue = true;
      if (row.status === "DUE_SOON") hasDueSoon = true;
      if (STATUS_PRIORITY[row.status] > STATUS_PRIORITY[overall]) {
        overall = row.status;
      }
    }
    result.set(bikeId, { hasOverdue, hasDueSoon, overallStatus: overall });
  }
  return result;
}

function nextDueAtFromCycle(lastServicedAt: string | null, cycleMonths: number | null): string | null {
  if (cycleMonths === null) return null;
  const base = lastServicedAt ? new Date(lastServicedAt) : null;
  if (!base || Number.isNaN(base.valueOf())) return null;
  const next = new Date(base);
  next.setMonth(next.getMonth() + cycleMonths);
  return next.toISOString();
}

function classifyByDate(servicedAt: Date, nextDueAt: Date, now: Date): MaintenanceStatus {
  const totalSpan = nextDueAt.valueOf() - servicedAt.valueOf();
  if (totalSpan <= 0) return "UNKNOWN";
  const elapsed = now.valueOf() - servicedAt.valueOf();
  const ratio = elapsed / totalSpan;
  if (ratio < APPROACH_RATIO) return "HEALTHY";
  if (ratio < 1) return "DUE_SOON";
  return "OVERDUE";
}
