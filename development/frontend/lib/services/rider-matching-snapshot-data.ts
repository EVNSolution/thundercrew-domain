import {
  type ServiceOpsContractCategory,
  type ServiceOpsContractDurationUnit,
  type ServiceOpsContractReturnType,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type RiderActiveContractSummary = {
  /** 활성 rider_bike_contract row id — 라이더 상세 다이얼로그에서 "계약 종료"
   *  를 호출할 때 그대로 server action 에 넘긴다. */
  contractId: string;
  category: ServiceOpsContractCategory | null;
  returnType: ServiceOpsContractReturnType | null;
  durationLabel: string | null;
};

export type RiderMatchingSnapshot = {
  /** Total active rider-bike contracts (= matched pairs). */
  activeContractCount: number;
  /** rider ids with ≥1 active rider-bike contract. */
  matchedRiderIds: Set<string>;
  /**
   * Per-rider most-recent education type. Filled from the latest
   * rider-education-record by completedAt; riders with no record are
   * absent from the map. Drives the riders-tab '교육' column.
   */
  educationTypeByRiderId: Map<string, "ONLINE" | "OFFLINE">;
  /**
   * Per-rider summary of the rider's primary active contract's template
   * (category / returnType / duration). When a
   * rider has multiple active contracts we keep the most recent one,
   * which is the natural "current arrangement" for table display.
   */
  riderActiveContractById: Map<string, RiderActiveContractSummary>;
  /** Map<bikeId, riderId> for active contracts - lets VehiclesPanel
   *  look up the rider currently driving a vehicle. */
  bikeActiveRiderById: Map<string, string>;
};

/**
 * Aggregate root page needs to render the KPI tile + the three tab
 * panels' badge / template-summary columns in a single render. Pages
 * 200 rows from each list endpoint and buckets by id here.
 */
export async function loadRiderMatchingSnapshot(): Promise<RiderMatchingSnapshot> {
  const empty: RiderMatchingSnapshot = {
    activeContractCount: 0,
    matchedRiderIds: new Set(),
    educationTypeByRiderId: new Map(),
    riderActiveContractById: new Map(),
    bikeActiveRiderById: new Map()
  };

  if (!serviceOpsApiConfigured()) return empty;
  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) return empty;

  try {
    const [contractPage, educationPage, templatePage] = await Promise.all([
      client.listRiderBikeContracts({ page: 0, size: 200 }),
      client.listRiderEducationRecords({ page: 0, size: 200 }),
      client.listContractTemplates({ page: 0, size: 200 })
    ]);

    // 양식별 표시용 필드 사전. contractId 는 양식 차원이 아니라 계약 인스턴스
    // 차원이라 여기엔 들어가지 않고, 아래에서 contract.id 와 합쳐 final summary
    // 가 만들어진다.
    const templateShapeById = new Map<string, Omit<RiderActiveContractSummary, "contractId">>();
    for (const template of templatePage.items) {
      templateShapeById.set(template.id, {
        category: template.category ?? null,
        returnType: template.returnType ?? null,
        durationLabel: formatDurationLabel(
          template.unlimited,
          template.durationUnit ?? null,
          template.durationValue ?? null
        )
      });
    }

    const matchedRiderIds = new Set<string>();
    const bikeActiveRiderById = new Map<string, string>();
    const riderActiveContractById = new Map<string, RiderActiveContractSummary>();
    let activeContractCount = 0;
    // "활성" 매칭의 정의: terminatedAt 도 null 이고, end_at 도 지나지 않은 것.
    // 백엔드는 expired 계약(endAt < now) 을 terminate 호출로 다시 종료하지
    // 못하게 막아 둔다 (assertContractCanTerminate). 그래서 expired 가 active
    // 처럼 표시되면 운영자가 종료 버튼을 눌러도 silent 거부 — 그 행을 처음부터
    // 비활성으로 취급한다.
    const nowMs = Date.now();
    const sortedActive = contractPage.items
      .filter((contract) => {
        if (contract.terminatedAt !== null) return false;
        if (contract.endAt === null) return true;
        const endMs = Date.parse(contract.endAt);
        return Number.isNaN(endMs) ? true : endMs > nowMs;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const contract of sortedActive) {
      activeContractCount += 1;
      matchedRiderIds.add(contract.riderId);
      bikeActiveRiderById.set(contract.bikeId, contract.riderId);
      if (!riderActiveContractById.has(contract.riderId)) {
        const shape = templateShapeById.get(contract.contractTemplateId) ?? {
          category: null,
          returnType: null,
          durationLabel: null
        };
        // 기간 표시는 양식의 "12개월" 같은 명목 길이가 아니라 이 계약의 실제
        // start_at ~ end_at 구간으로 갈음한다. 운영자가 "언제부터 언제까지"
        // 를 한눈에 보기 위함. 무기한(end_at null) 이면 "~ 무제한" 으로 표기.
        const periodLabel = formatContractPeriod(contract.startAt, contract.endAt);
        riderActiveContractById.set(contract.riderId, {
          contractId: contract.id,
          ...shape,
          durationLabel: periodLabel ?? shape.durationLabel
        });
      }
    }

    // Sort education records by completedAt desc and keep the first
    // entry per rider so the riders-tab '교육' column reflects the
    // operator's most recent training type (ONLINE vs OFFLINE).
    const educationTypeByRiderId = new Map<string, "ONLINE" | "OFFLINE">();
    const sortedEducation = educationPage.items
      .slice()
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    for (const record of sortedEducation) {
      if (!educationTypeByRiderId.has(record.riderId)) {
        educationTypeByRiderId.set(record.riderId, record.educationType);
      }
    }

    return {
      activeContractCount,
      matchedRiderIds,
      educationTypeByRiderId,
      riderActiveContractById,
      bikeActiveRiderById
    };
  } catch {
    return empty;
  }
}

function formatDurationLabel(
  unlimited: boolean | undefined,
  unit: ServiceOpsContractDurationUnit | null | undefined,
  value: number | null | undefined
): string | null {
  if (unlimited) return "무제한";
  if (!unit || value === null || value === undefined) return null;
  const suffix: Record<ServiceOpsContractDurationUnit, string> = {
    DAY: "일",
    WEEK: "주",
    MONTH: "개월",
    QUARTER: "분기",
    HALF_YEAR: "반기",
    YEAR: "년"
  };
  return `${value}${suffix[unit] ?? ""}`;
}

/** ISO instant → "YYYY.MM.DD" (KST). 잘못된 입력이면 null. */
function formatKstDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return null;
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return null;
  return `${y}.${m}.${day}`;
}

/** 계약의 start_at ~ end_at 구간을 사람이 읽기 쉬운 "2026.05.18 ~ 2027.05.18"
 *  형태로 변환. end_at 가 null 이면 "~ 무제한". start_at 자체가 파싱 실패하면
 *  null 을 돌려 호출 측이 다른 라벨로 폴백할 수 있게 한다. */
function formatContractPeriod(startAt: string, endAt: string | null): string | null {
  const start = formatKstDate(startAt);
  if (!start) return null;
  if (!endAt) return `${start} ~ 무제한`;
  const end = formatKstDate(endAt);
  if (!end) return `${start} ~`;
  return `${start} ~ ${end}`;
}
