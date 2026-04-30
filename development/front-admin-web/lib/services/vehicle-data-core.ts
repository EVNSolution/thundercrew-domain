import type { FrontendVehicle } from "./service-ops-api";

export type VehicleDataResult = {
  source: "mock" | "service-ops";
  vehicles: FrontendVehicle[];
  notice?: string;
};

export type VehicleDetailResult = {
  source: "mock" | "service-ops";
  vehicle: FrontendVehicle;
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
