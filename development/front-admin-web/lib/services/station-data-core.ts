import type { BatteryStation } from "@/types/domain";

export type StationDataResult = {
  source: "mock" | "service-ops";
  stations: BatteryStation[];
  notice?: string;
};

export type StationDetailResult = {
  source: "mock" | "service-ops";
  station: BatteryStation;
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
    notice,
    source: "mock",
    station: normalizeMockStation(mockStations[0])
  };
}

export function mockStationUnconfiguredServiceDetail(slug: string, mockStations: BatteryStation[]): StationDetailResult | null {
  return mockStationUnavailableServiceDetail(
    slug,
    mockStations,
    "SERVICE_OPS_API_BASE_URL이 없어 mock 스테이션 상세를 표시합니다. 백엔드 연결 후 실제 스테이션 상세로 전환됩니다."
  );
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
