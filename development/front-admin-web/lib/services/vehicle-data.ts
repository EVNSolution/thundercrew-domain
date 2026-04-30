import {
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import { vehicles as mockVehicles } from "@/lib/services/mock-data";
import {
  type VehicleDataResult,
  type VehicleDetailResult,
  isUuidLike,
  mockVehicleDetail,
  mockVehicleList,
  mockVehicleUnconfiguredServiceDetail,
  mockVehicleUnavailableServiceDetail
} from "@/lib/services/vehicle-data-core";

export async function loadVehicleList(): Promise<VehicleDataResult> {
  const fallback = mockVehicleList(mockVehicles);

  if (!serviceOpsApiConfigured()) {
    return {
      ...fallback,
      notice: "SERVICE_OPS_API_BASE_URL이 없어 mock 차량 데이터를 표시합니다. 백엔드 연결 시 서버 액션이 실제 API를 호출합니다."
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      ...fallback,
      notice: "서비스 API 세션 쿠키가 없어 mock 차량 데이터를 표시합니다. 관리자 로그인 후 실제 백엔드 목록으로 전환됩니다."
    };
  }

  try {
    const page = await client.listVehicles({ page: 0, size: 100 });
    return { source: "service-ops", vehicles: page.items };
  } catch (error) {
    return {
      ...fallback,
      notice: `서비스 API 차량 조회 실패로 mock 차량 데이터를 표시합니다.${formatServiceOpsError(error)}`
    };
  }
}

export async function loadVehicleDetail(slug: string): Promise<VehicleDetailResult | null> {
  const fallback = mockVehicleDetail(slug, mockVehicles);

  if (!serviceOpsApiConfigured() && isUuidLike(slug)) {
    return mockVehicleUnconfiguredServiceDetail(slug, mockVehicles);
  }

  if (serviceOpsApiConfigured() && isUuidLike(slug)) {
    const client = await createAuthenticatedServiceOpsApiClient();

    if (!client) {
      return mockVehicleUnavailableServiceDetail(
        slug,
        mockVehicles,
        "서비스 API 세션 쿠키가 없어 mock 차량 상세를 표시합니다. 관리자 로그인 후 실제 백엔드 상세로 전환됩니다."
      );
    }

    try {
      const vehicle = await client.getVehicle(slug);
      return { source: "service-ops", vehicle };
    } catch (error) {
      return mockVehicleUnavailableServiceDetail(
        slug,
        mockVehicles,
        `서비스 API 차량 상세 조회 실패로 mock 차량 데이터를 표시합니다.${formatServiceOpsError(error)}`
      );
    }
  }

  return fallback;
}

function formatServiceOpsError(error: unknown): string {
  const serviceError = error as Partial<ServiceOpsApiError>;
  if (serviceError?.status) {
    return ` (${serviceError.status}${serviceError.code ? `/${serviceError.code}` : ""})`;
  }

  return "";
}
