import {
  type ServiceOpsApiError,
  type ServiceOpsBikeSnapshot,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type BikeSnapshotResult = {
  bikeId: string;
  data: ServiceOpsBikeSnapshot | null;
  source: "service-ops" | "mock";
  notice?: string;
};

/**
 * Loader for the per-bike join snapshot. Mirrors the dashboard map-state
 * loader pattern: returns {@code data: null} on every fallback (no API base,
 * no session, fetch failed, 404) so the detail panel can keep rendering the
 * BikePin info it already has and surface a small notice.
 */
export async function loadBikeSnapshot(bikeId: string): Promise<BikeSnapshotResult> {
  if (!serviceOpsApiConfigured()) {
    return {
      bikeId,
      data: null,
      source: "mock",
      notice:
        "SERVICE_OPS_API_BASE_URL이 없어 차량 상세 데이터를 표시할 수 없습니다."
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      bikeId,
      data: null,
      source: "mock",
      notice:
        "관리자 세션이 없어 차량 상세 데이터를 표시할 수 없습니다."
    };
  }

  try {
    const data = await client.getBikeSnapshot(bikeId);
    return { bikeId, data, source: "service-ops" };
  } catch (error) {
    return {
      bikeId,
      data: null,
      source: "mock",
      notice: `차량 상세 조회 실패.${formatServiceOpsError(error)}`
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
