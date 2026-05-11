import {
  type ServiceOpsApiError,
  type ServiceOpsRiderEducationRecord,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type RiderEducationRecordsResult = {
  riderId: string;
  records: ServiceOpsRiderEducationRecord[];
  source: "service-ops" | "mock";
  notice?: string;
  /**
   * Snapshot of `Date.now()` taken on the server during the load. The detail
   * page uses this to decide which records are expired without calling
   * `Date.now()` itself during render — the React 19 purity lint rule blocks
   * impure clock reads from server component bodies.
   */
  nowMs: number;
};

/**
 * Loader for the rider's education record history. The rider detail page
 * embeds this list in the {@code 교육 이력} section. We page through up to
 * 50 rows because the operator typically only cares about recent training
 * entries; older records are still in the backend but not surfaced in the
 * detail page.
 */
export async function loadRiderEducationRecords(riderId: string): Promise<RiderEducationRecordsResult> {
  if (!serviceOpsApiConfigured()) {
    return {
      riderId,
      records: [],
      source: "mock",
      nowMs: Date.now()
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      riderId,
      records: [],
      source: "mock",
      notice: "관리자 세션이 없어 교육 이력을 표시할 수 없습니다.",
      nowMs: Date.now()
    };
  }

  try {
    const page = await client.listRiderEducationRecordsByRider(riderId, { page: 0, size: 50 });
    return { riderId, records: page.items, source: "service-ops", nowMs: Date.now() };
  } catch (error) {
    return {
      riderId,
      records: [],
      source: "mock",
      notice: `교육 이력 조회 실패.${formatServiceOpsError(error)}`,
      nowMs: Date.now()
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
