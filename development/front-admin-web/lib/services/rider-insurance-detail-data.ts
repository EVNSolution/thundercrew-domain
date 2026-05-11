import {
  type ServiceOpsApiError,
  type ServiceOpsRiderInsurance,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type RiderInsuranceDetailResult = {
  insuranceId: string;
  data: ServiceOpsRiderInsurance | null;
  source: "service-ops" | "mock";
  notice?: string;
};

/**
 * Single-record loader for the rider insurance edit page. Returns
 * {@code data: null} on every fallback path (no API base, no session,
 * fetch failed, 404) so the page can render a "조회 실패" notice instead
 * of crashing.
 */
export async function loadRiderInsuranceDetail(
  insuranceId: string
): Promise<RiderInsuranceDetailResult> {
  if (!serviceOpsApiConfigured()) {
    return { insuranceId, data: null, source: "mock" };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      insuranceId,
      data: null,
      source: "mock",
      notice: "관리자 세션이 없어 보험 정보를 불러올 수 없습니다."
    };
  }

  try {
    const data = await client.getRiderInsurance(insuranceId);
    return { insuranceId, data, source: "service-ops" };
  } catch (error) {
    return {
      insuranceId,
      data: null,
      source: "mock",
      notice: `보험 조회 실패.${formatServiceOpsError(error)}`
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
