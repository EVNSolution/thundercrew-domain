import type {
  ServiceOpsIntegrityFinding,
  ServiceOpsIntegrityFindingCategory,
  ServiceOpsIntegrityScan,
  ServiceOpsIntegritySummary
} from "./service-ops-api";

const EXCLUDED_SOURCE_TABLES = new Set(["bike_recent_states", "bike_current_states"]);

export type IntegrityFinding = ServiceOpsIntegrityFinding & {
  categoryLabel: string;
  sourceLabel: string;
  targetLabel: string;
  referenceFieldLabel: string;
  severity: "warning" | "danger";
};

export type IntegritySummaryItem = {
  category: ServiceOpsIntegrityFindingCategory;
  categoryLabel: string;
  count: number;
};

export type IntegrityDataResult = {
  excludedFindingCount: number;
  findings: IntegrityFinding[];
  generatedAt: string;
  notice?: string;
  source: "mock" | "service-ops";
  summary: IntegritySummaryItem[];
  totalFindings: number;
  visibleFindingCount: number;
};

export function toFrontendIntegrityData(scan: ServiceOpsIntegrityScan, source: "mock" | "service-ops" = "service-ops"): IntegrityDataResult {
  const visibleFindings = scan.findings.filter((finding) => !EXCLUDED_SOURCE_TABLES.has(finding.sourceTable));
  const excludedFindingCount = scan.findings.length - visibleFindings.length;

  return {
    excludedFindingCount,
    findings: visibleFindings.map(toFrontendIntegrityFinding),
    generatedAt: scan.generatedAt,
    source,
    summary: summarizeVisibleFindings(visibleFindings, scan.summary),
    totalFindings: scan.totalFindings,
    visibleFindingCount: visibleFindings.length
  };
}

export function mockIntegrityData(notice?: string): IntegrityDataResult {
  return {
    ...toFrontendIntegrityData({
      findings: [
        {
          category: "REFERENCE_NOT_FOUND",
          message: "rider_bike_contracts.bike_id references missing bikes",
          referenceField: "bike_id",
          referenceId: "11111111-1111-4111-8111-111111111111",
          sourceId: "22222222-2222-4222-8222-222222222222",
          sourceIdx: 2,
          sourceTable: "rider_bike_contracts",
          targetTable: "bikes"
        },
        {
          category: "REFERENCE_DELETED",
          message: "bike_equipments.equipment_type_id references deleted equipment_types",
          referenceField: "equipment_type_id",
          referenceId: "33333333-3333-4333-8333-333333333333",
          sourceId: "44444444-4444-4444-8444-444444444444",
          sourceIdx: 4,
          sourceTable: "bike_equipments",
          targetTable: "equipment_types"
        }
      ],
      generatedAt: "2026-04-30T00:00:00Z",
      summary: [
        { category: "REFERENCE_NOT_FOUND", count: 1 },
        { category: "REFERENCE_DELETED", count: 1 }
      ],
      totalFindings: 2
    }, "mock"),
    notice
  };
}

export function toCategoryLabel(category: ServiceOpsIntegrityFindingCategory): string {
  switch (category) {
    case "REFERENCE_NOT_FOUND":
      return "대상 없음";
    case "REFERENCE_DELETED":
      return "삭제 대상 참조";
  }
}

function toFrontendIntegrityFinding(finding: ServiceOpsIntegrityFinding): IntegrityFinding {
  return {
    ...finding,
    categoryLabel: toCategoryLabel(finding.category),
    referenceFieldLabel: toDisplayLabel(finding.referenceField),
    severity: finding.category === "REFERENCE_NOT_FOUND" ? "danger" : "warning",
    sourceLabel: tableLabel(finding.sourceTable),
    targetLabel: tableLabel(finding.targetTable)
  };
}

function summarizeVisibleFindings(
  findings: ServiceOpsIntegrityFinding[],
  fallbackSummary: ServiceOpsIntegritySummary[]
): IntegritySummaryItem[] {
  if (!findings.length) {
    return [];
  }

  const counts = new Map<ServiceOpsIntegrityFindingCategory, number>();
  findings.forEach((finding) => counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1));

  const order = fallbackSummary.map((item) => item.category);
  (["REFERENCE_NOT_FOUND", "REFERENCE_DELETED"] as const).forEach((category) => {
    if (!order.includes(category)) {
      order.push(category);
    }
  });

  return order
    .filter((category) => counts.has(category))
    .map((category) => ({ category, categoryLabel: toCategoryLabel(category), count: counts.get(category) ?? 0 }));
}

function tableLabel(table: string): string {
  const labels: Record<string, string> = {
    battery_stations: "배터리 스테이션",
    bike_device_installations: "차량 단말 설치",
    bike_equipments: "바이크 장비",
    bikes: "차량",
    contract_templates: "계약 양식",
    devices: "단말",
    equipment_types: "장비 종류",
    insurance_items: "보험 항목",
    rider_bike_contracts: "라이더-차량 계약",
    rider_insurances: "라이더 보험",
    riders: "라이더",
    station_battery_count_logs: "스테이션 수량 로그"
  };

  return labels[table] ?? toDisplayLabel(table);
}

function toDisplayLabel(value: string): string {
  return value.replaceAll("_", " ");
}
