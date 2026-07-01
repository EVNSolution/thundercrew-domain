import {
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import type { BatteryStation } from "@/types/domain";

export type StationDataResult = {
  stations: BatteryStation[];
  source: "service-ops" | "empty";
  notice?: string;
};

/**
 * Loader for the station list rendered on `/?tab=stations`. No
 * mock fallback - empty array when the backend is unavailable; the panel
 * renders an empty table with a "데이터 없음" placeholder row.
 */
export async function loadStationList(): Promise<StationDataResult> {
  if (!serviceOpsApiConfigured()) {
    return { stations: [], source: "empty" };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      stations: [],
      source: "empty",
      notice: "관리자 세션이 없어 스테이션 목록을 불러올 수 없습니다."
    };
  }

  try {
    const page = await client.listBatteryStations({ page: 0, size: 100 });
    return { stations: page.items, source: "service-ops" };
  } catch (error) {
    return {
      stations: [],
      source: "empty",
      notice: `스테이션 목록 조회 실패.${formatServiceOpsError(error)}`
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
