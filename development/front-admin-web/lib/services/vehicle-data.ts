import {
  type FrontendVehicle,
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type VehicleDataResult = {
  vehicles: FrontendVehicle[];
  source: "service-ops" | "empty";
  notice?: string;
};

/**
 * Loader for the vehicle list rendered on `/?tab=vehicles`. No
 * mock fallback - empty array when the backend is unavailable; the panel
 * renders an empty table with a "데이터 없음" placeholder row.
 */
export async function loadVehicleList(): Promise<VehicleDataResult> {
  if (!serviceOpsApiConfigured()) {
    return { vehicles: [], source: "empty" };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      vehicles: [],
      source: "empty",
      notice: "관리자 세션이 없어 차량 목록을 불러올 수 없습니다."
    };
  }

  try {
    const page = await client.listVehicles({ page: 0, size: 100 });
    return { vehicles: page.items, source: "service-ops" };
  } catch (error) {
    return {
      vehicles: [],
      source: "empty",
      notice: `차량 목록 조회 실패.${formatServiceOpsError(error)}`
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
