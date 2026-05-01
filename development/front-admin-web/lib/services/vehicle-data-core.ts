import type {
  FrontendVehicle,
  ServiceOpsBikeOperationStatus,
  ServiceOpsBikeOperationStatusHistory,
  ServiceOpsPage
} from "./service-ops-api";

const AUDIT_HISTORY_PAGE_SIZE = 100;
const AUDIT_HISTORY_ROW_LIMIT = 20;
const AUDIT_HISTORY_SORT = "idx,desc";

type VehicleOperationHistoryPageLoader = (params: {
  page: number;
  size: number;
  sort: string;
}) => Promise<ServiceOpsPage<ServiceOpsBikeOperationStatusHistory>>;

export type VehicleOperationHistoryRow = {
  statusLabel: FrontendVehicle["status"];
  startedAt: string;
  endedAt: string;
  reason: string;
  memo: string;
};

export type VehicleDataResult = {
  source: "mock" | "service-ops";
  vehicles: FrontendVehicle[];
  notice?: string;
};

export type VehicleDetailResult = {
  source: "mock" | "service-ops";
  vehicle: FrontendVehicle;
  operationHistory: VehicleOperationHistoryRow[];
  notice?: string;
};

export function mockVehicleList(mockVehicles: FrontendVehicle[]): VehicleDataResult {
  return {
    source: "mock",
    vehicles: mockVehicles.map((vehicle) => ({ ...vehicle, source: "mock" as const }))
  };
}

export function mockVehicleDetail(slug: string, mockVehicles: FrontendVehicle[]): VehicleDetailResult | null {
  const vehicle = mockVehicles.find((candidate) => candidate.slug === slug);

  if (!vehicle) {
    return null;
  }

  return {
    source: "mock",
    operationHistory: [],
    vehicle: { ...vehicle, source: "mock" }
  };
}

export function mockVehicleUnavailableServiceDetail(
  slug: string,
  mockVehicles: FrontendVehicle[],
  notice: string
): VehicleDetailResult | null {
  const exactFallback = mockVehicleDetail(slug, mockVehicles);
  if (exactFallback) {
    return { ...exactFallback, notice };
  }

  if (!isUuidLike(slug) || !mockVehicles.length) {
    return null;
  }

  return {
    notice,
    operationHistory: [],
    source: "mock",
    vehicle: { ...mockVehicles[0], source: "mock" }
  };
}

export function mockVehicleUnconfiguredServiceDetail(slug: string, mockVehicles: FrontendVehicle[]): VehicleDetailResult | null {
  return mockVehicleUnavailableServiceDetail(
    slug,
    mockVehicles,
    "SERVICE_OPS_API_BASE_URL이 없어 mock 차량 상세를 표시합니다. 백엔드 연결 후 실제 차량 상세로 전환됩니다."
  );
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function toVehicleOperationHistoryRows(
  histories: ServiceOpsBikeOperationStatusHistory[],
  vehicleId: string
): VehicleOperationHistoryRow[] {
  return histories
    .filter((history) => history.bikeId === vehicleId)
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
    .map((history) => ({
      endedAt: history.endedAt ? formatKstMinute(history.endedAt) : "진행 중",
      memo: history.memo?.trim() || "없음",
      reason: history.reason?.trim() || "사유 없음",
      startedAt: formatKstMinute(history.startedAt),
      statusLabel: toVehicleStatusLabel(history.operationStatus)
    }));
}

export async function loadVehicleOperationHistoryRows(
  loadPage: VehicleOperationHistoryPageLoader,
  vehicleId: string,
  limit = AUDIT_HISTORY_ROW_LIMIT
): Promise<VehicleOperationHistoryRow[]> {
  const rows: VehicleOperationHistoryRow[] = [];
  let page = 0;

  while (rows.length < limit) {
    const response = await loadPage({
      page,
      size: AUDIT_HISTORY_PAGE_SIZE,
      sort: AUDIT_HISTORY_SORT
    });
    rows.push(...toVehicleOperationHistoryRows(response.items, vehicleId));

    if (!response.page.hasNext) {
      break;
    }

    page += 1;
  }

  return rows.slice(0, limit);
}

function toVehicleStatusLabel(status: ServiceOpsBikeOperationStatus): FrontendVehicle["status"] {
  switch (status) {
    case "IN_SERVICE":
      return "운행 중";
    case "REPAIRING":
      return "수리";
    case "INSPECTION_REQUIRED":
      return "점검 필요";
    case "READY":
      return "대기";
  }
}

function formatKstMinute(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ");
}
