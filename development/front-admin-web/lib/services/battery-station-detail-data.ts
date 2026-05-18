import {
  type FrontendBatteryStation,
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type BatteryStationDetailResult = {
  stationId: string;
  data: FrontendBatteryStation | null;
  source: "service-ops" | "mock";
  notice?: string;
};

/**
 * Loader for the station detail panel. Mirrors the bike-current-state and
 * bike-snapshot loaders so the panel keeps rendering its StationPin info on
 * every fallback path (no API base / no session / fetch failed) and surfaces
 * a small notice instead of blanking.
 */
export async function loadBatteryStationDetail(stationId: string): Promise<BatteryStationDetailResult> {
  if (!serviceOpsApiConfigured()) {
    return {
      stationId,
      data: null,
      source: "mock"
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      stationId,
      data: null,
      source: "mock",
      notice: "관리자 세션이 없어 충전소 상세를 표시할 수 없습니다."
    };
  }

  try {
    const data = await client.getBatteryStation(stationId);
    return { stationId, data, source: "service-ops" };
  } catch (error) {
    return {
      stationId,
      data: null,
      source: "mock",
      notice: `충전소 상세 조회 실패.${formatServiceOpsError(error)}`
    };
  }
}

function formatServiceOpsError(error: unknown): string {
  const apiError = error as Partial<ServiceOpsApiError> | undefined;
  if (apiError?.code) {
    return ` (${apiError.code})`;
  }
  if (error instanceof Error) {
    return ` (${error.message})`;
  }
  return "";
}
