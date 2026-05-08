import {
  type FrontendBikeCurrentState,
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type BikeCurrentStateResult = {
  bikeId: string;
  data: FrontendBikeCurrentState | null;
  source: "service-ops" | "mock";
  notice?: string;
};

/**
 * Single-bike telemetry loader. Returns {@code data: null} on every fallback
 * path (no API base, no session, fetch failed, 404) so the detail panel can
 * still render the BikePin info it already has and show a small notice.
 */
export async function loadBikeCurrentState(bikeId: string): Promise<BikeCurrentStateResult> {
  if (!serviceOpsApiConfigured()) {
    return {
      bikeId,
      data: null,
      source: "mock",
      notice:
        "SERVICE_OPS_API_BASE_URL이 없어 단일 차량 텔레메트리를 표시할 수 없습니다."
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      bikeId,
      data: null,
      source: "mock",
      notice:
        "관리자 세션이 없어 단일 차량 텔레메트리를 표시할 수 없습니다."
    };
  }

  try {
    const data = await client.getBikeCurrentState(bikeId);
    return { bikeId, data, source: "service-ops" };
  } catch (error) {
    return {
      bikeId,
      data: null,
      source: "mock",
      notice: `단일 차량 텔레메트리 조회 실패.${formatServiceOpsError(error)}`
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
