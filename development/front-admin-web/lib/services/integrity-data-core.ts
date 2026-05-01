import type {
  ServiceOpsIntegrityFinding,
  ServiceOpsIntegrityFindingCategory,
  ServiceOpsIntegrityScan,
  ServiceOpsIntegritySummary
} from "./service-ops-api";

const EXCLUDED_SOURCE_TABLES = new Set(["bike_recent_states", "bike_current_states"]);

export type IntegrityFinding = {
  category: ServiceOpsIntegrityFindingCategory;
  categoryLabel: string;
  message: string;
  referenceField: string;
  referenceFieldLabel: string;
  rowKey: string;
  severity: "warning" | "danger";
  sourceIdx: number | null;
  sourceLabel: string;
  sourceTable: string;
  targetLabel: string;
  targetTable: string;
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
          referenceId: "mock-missing-bike",
          sourceId: "mock-rider-contract",
          sourceIdx: 2,
          sourceTable: "rider_bike_contracts",
          targetTable: "bikes"
        },
        {
          category: "REFERENCE_DELETED",
          message: "bike_equipments.equipment_type_id references deleted equipment_types",
          referenceField: "equipment_type_id",
          referenceId: "mock-deleted-equipment-type",
          sourceId: "mock-bike-equipment",
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

function toFrontendIntegrityFinding(finding: ServiceOpsIntegrityFinding, index: number): IntegrityFinding {
  return {
    category: finding.category,
    categoryLabel: toCategoryLabel(finding.category),
    message: redactGeneratedUuid(finding.message),
    referenceField: finding.referenceField,
    referenceFieldLabel: toDisplayLabel(finding.referenceField),
    rowKey: [finding.sourceTable, finding.sourceIdx ?? `row-${index}`, finding.referenceField, finding.targetTable, finding.category].join(":"),
    severity: finding.category === "REFERENCE_NOT_FOUND" ? "danger" : "warning",
    sourceIdx: finding.sourceIdx,
    sourceLabel: tableLabel(finding.sourceTable),
    sourceTable: finding.sourceTable,
    targetLabel: tableLabel(finding.targetTable),
    targetTable: finding.targetTable
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

function redactGeneratedUuid(value: string): string {
  return value.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "비공개 ID");
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
