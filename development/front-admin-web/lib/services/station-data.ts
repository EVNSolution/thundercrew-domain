import {
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import { stations as mockStations } from "@/lib/services/mock-data";
import {
  type StationDataResult,
  type StationDetailResult,
  isUuidLike,
  loadStationBatteryCountLogRows,
  mockStationDetail,
  mockStationList,
  mockStationUnconfiguredServiceDetail,
  mockStationUnavailableServiceDetail
} from "@/lib/services/station-data-core";

export async function loadStationList(): Promise<StationDataResult> {
  const fallback = mockStationList(mockStations);

  if (!serviceOpsApiConfigured()) {
    return {
      ...fallback,
      notice: "SERVICE_OPS_API_BASE_URL이 없어 mock 스테이션 데이터를 표시합니다. 백엔드 연결 시 서버 액션이 실제 API를 호출합니다."
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      ...fallback,
      notice: "서비스 API 세션 쿠키가 없어 mock 스테이션 데이터를 표시합니다. 관리자 로그인 후 실제 백엔드 목록으로 전환됩니다."
    };
  }

  try {
    const page = await client.listBatteryStations({ page: 0, size: 100 });
    return { source: "service-ops", stations: page.items };
  } catch (error) {
    return {
      ...fallback,
      notice: `서비스 API 스테이션 조회 실패로 mock 스테이션 데이터를 표시합니다.${formatServiceOpsError(error)}`
    };
  }
}

export async function loadStationDetail(slug: string): Promise<StationDetailResult | null> {
  const fallback = mockStationDetail(slug, mockStations);

  if (!serviceOpsApiConfigured() && isUuidLike(slug)) {
    return mockStationUnconfiguredServiceDetail(slug, mockStations);
  }

  if (serviceOpsApiConfigured() && isUuidLike(slug)) {
    const client = await createAuthenticatedServiceOpsApiClient();

    if (!client) {
      return mockStationUnavailableServiceDetail(
        slug,
        mockStations,
        "서비스 API 세션 쿠키가 없어 mock 스테이션 상세를 표시합니다. 관리자 로그인 후 실제 백엔드 상세로 전환됩니다."
      );
    }

    try {
      const station = await client.getBatteryStation(slug);
      try {
        return {
          countLogs: await loadStationBatteryCountLogRows(client.listStationBatteryCountLogs, station.id ?? station.slug),
          source: "service-ops",
          station
        };
      } catch (error) {
        return {
          countLogs: [],
          notice: `서비스 API 스테이션 상세는 조회했지만 재고 이력 조회에 실패했습니다.${formatServiceOpsError(error)}`,
          source: "service-ops",
          station
        };
      }
    } catch (error) {
      return mockStationUnavailableServiceDetail(
        slug,
        mockStations,
        `서비스 API 스테이션 상세 조회 실패로 mock 스테이션 데이터를 표시합니다.${formatServiceOpsError(error)}`
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
