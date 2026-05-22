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
 *   (운영 시간 누적 추적은 V22 시점에 백엔드 인프라가 없어 운영 일수 기준 단순화)
 * - cycle_km 만 잡힌 품목은 odometer 텔레메트리가 없어 자동 상태 계산을 안 함 —
 *   "교환 완료" 시 운영자가 입력한 odometer 가 있으면 그걸 마지막 km 로 노출.
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

export function deriveMaintenanceRows(
  items: ReadonlyArray<ServiceOpsMaintenanceItem>,
  records: ReadonlyArray<ServiceOpsVehicleMaintenanceRecord>,
  now: Date = new Date()
): DerivedMaintenanceRow[] {
  // itemId → 가장 최근 기록 (records 가 이미 servicedAt desc 정렬이라 first hit).
  const latestByItem = new Map<string, ServiceOpsVehicleMaintenanceRecord>();
  for (const record of records) {
    if (!latestByItem.has(record.itemId)) {
      latestByItem.set(record.itemId, record);
    }
  }

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

    // cycle_km 만 있는 케이스 — odometer 텔레메트리 없어 자동 상태 derive 안 함.
    // 운영자가 lastServicedAtOdometerKm + cycle_km 을 보고 직접 판단.
    return {
      item,
      lastServicedAt,
      lastServicedAtOdometerKm,
      nextDueAt: null,
      status: "UNKNOWN"
    };
  });
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
