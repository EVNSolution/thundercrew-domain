import type { BatteryStation } from "@/types/domain";
import type { ServiceOpsPage, ServiceOpsStationBatteryCountLog } from "./service-ops-api";

const AUDIT_LOG_PAGE_SIZE = 100;
const AUDIT_LOG_ROW_LIMIT = 20;
const AUDIT_LOG_SORT = "idx,desc";

type StationBatteryCountLogPageLoader = (params: {
  page: number;
  size: number;
  sort: string;
}) => Promise<ServiceOpsPage<ServiceOpsStationBatteryCountLog>>;

export type StationBatteryCountLogRow = {
  changedAt: string;
  maxChange: string;
  currentChange: string;
  availableChange: string;
  reason: string;
  memo: string;
};

export type StationDataResult = {
  source: "mock" | "service-ops";
  stations: BatteryStation[];
  notice?: string;
};

export type StationDetailResult = {
  source: "mock" | "service-ops";
  station: BatteryStation;
  countLogs: StationBatteryCountLogRow[];
  notice?: string;
};

export function mockStationList(mockStations: BatteryStation[]): StationDataResult {
  return {
    source: "mock",
    stations: mockStations.map(normalizeMockStation)
  };
}

export function mockStationDetail(slug: string, mockStations: BatteryStation[]): StationDetailResult | null {
  const station = mockStations.find((candidate) => candidate.slug === slug);
  if (!station) {
    return null;
  }

  return {
    source: "mock",
    countLogs: [],
    station: normalizeMockStation(station)
  };
}

export function mockStationUnavailableServiceDetail(
  slug: string,
  mockStations: BatteryStation[],
  notice: string
): StationDetailResult | null {
  const exactFallback = mockStationDetail(slug, mockStations);
  if (exactFallback) {
    return { ...exactFallback, notice };
  }

  if (!isUuidLike(slug) || !mockStations.length) {
    return null;
  }

  return {
    countLogs: [],
    notice,
    source: "mock",
    station: normalizeMockStation(mockStations[0])
  };
}

export function mockStationUnconfiguredServiceDetail(slug: string, mockStations: BatteryStation[]): StationDetailResult | null {
  return mockStationUnavailableServiceDetail(slug, mockStations, "");
}

export function normalizeMockStation(station: BatteryStation): BatteryStation {
  const maxBatteryCapacity = station.maxBatteryCapacity ?? Math.max(station.batteryCount, station.replaceableCount);
  const currentBatteryCount = station.currentBatteryCount ?? station.batteryCount;
  const availableBatteryCount = station.availableBatteryCount ?? station.replaceableCount;

  return {
    ...station,
    availableBatteryCount,
    availableBatteryLabel: station.availableBatteryLabel ?? `${availableBatteryCount}/${maxBatteryCapacity}`,
    batteryCount: currentBatteryCount,
    capacityPercentage: station.capacityPercentage ?? calculateCapacityPercentage(currentBatteryCount, maxBatteryCapacity),
    currentBatteryCount,
    maxBatteryCapacity,
    replaceableCount: availableBatteryCount,
    source: "mock"
  };
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function calculateCapacityPercentage(currentBatteryCount: number, maxBatteryCapacity: number): number {
  if (maxBatteryCapacity === 0) {
    return 0;
  }

  return Math.round((currentBatteryCount * 100) / maxBatteryCapacity);
}

export function toStationBatteryCountLogRows(
  logs: ServiceOpsStationBatteryCountLog[],
  stationId: string
): StationBatteryCountLogRow[] {
  return logs
    .filter((log) => log.stationId === stationId)
    .sort((left, right) => Date.parse(right.changedAt) - Date.parse(left.changedAt))
    .map((log) => ({
      availableChange: formatCountChange(log.beforeAvailableBatteryCount, log.afterAvailableBatteryCount),
      changedAt: formatKstMinute(log.changedAt),
      currentChange: formatCountChange(log.beforeCurrentBatteryCount, log.afterCurrentBatteryCount),
      maxChange: formatCountChange(log.beforeMaxBatteryCapacity, log.afterMaxBatteryCapacity),
      memo: log.memo?.trim() || "없음",
      reason: log.reason?.trim() || "사유 없음"
    }));
}

export async function loadStationBatteryCountLogRows(
  loadPage: StationBatteryCountLogPageLoader,
  stationId: string,
  limit = AUDIT_LOG_ROW_LIMIT
): Promise<StationBatteryCountLogRow[]> {
  const rows: StationBatteryCountLogRow[] = [];
  let page = 0;

  while (rows.length < limit) {
    const response = await loadPage({
      page,
      size: AUDIT_LOG_PAGE_SIZE,
      sort: AUDIT_LOG_SORT
    });
    rows.push(...toStationBatteryCountLogRows(response.items, stationId));

    if (!response.page.hasNext) {
      break;
    }

    page += 1;
  }

  return rows.slice(0, limit);
}

function formatCountChange(before: number, after: number): string {
  return `${before} → ${after}`;
}

function formatKstMinute(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ");
}
