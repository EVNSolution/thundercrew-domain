import {
  type ServiceOpsApiError,
  type ServiceOpsRiderEducationRecord,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type RiderEducationRecordDetailResult = {
  recordId: string;
  data: ServiceOpsRiderEducationRecord | null;
  source: "service-ops" | "mock";
  notice?: string;
};

/**
 * Single-record loader for the rider education record edit page. Returns
 * {@code data: null} on every fallback path (no API base, no session,
 * fetch failed, 404) so the page can render a "조회 실패" notice instead
 * of crashing.
 */
export async function loadRiderEducationRecord(
  recordId: string
): Promise<RiderEducationRecordDetailResult> {
  if (!serviceOpsApiConfigured()) {
    return {
      recordId,
      data: null,
      source: "mock"
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      recordId,
      data: null,
      source: "mock",
      notice: "관리자 세션이 없어 교육 이력을 불러올 수 없습니다."
    };
  }

  try {
    const data = await client.getRiderEducationRecord(recordId);
    return { recordId, data, source: "service-ops" };
  } catch (error) {
    return {
      recordId,
      data: null,
      source: "mock",
      notice: `교육 이력 조회 실패.${formatServiceOpsError(error)}`
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
