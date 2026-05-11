import {
  type FrontendRider,
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type RiderDataResult = {
  riders: FrontendRider[];
  source: "service-ops" | "empty";
  notice?: string;
};

/**
 * Loader for the rider list rendered on `/overview ?tab=riders`. No mock
 * fallback - when the backend is not configured / no session / fetch
 * fails, the loader returns an empty array and the panel renders its
 * `라이더 없음` EmptyState.
 */
export async function loadRiderList(): Promise<RiderDataResult> {
  if (!serviceOpsApiConfigured()) {
    return { riders: [], source: "empty" };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      riders: [],
      source: "empty",
      notice: "관리자 세션이 없어 라이더 목록을 불러올 수 없습니다."
    };
  }

  try {
    const page = await client.listRiders({ page: 0, size: 100 });
    return { riders: page.items, source: "service-ops" };
  } catch (error) {
    return {
      riders: [],
      source: "empty",
      notice: `라이더 목록 조회 실패.${formatServiceOpsError(error)}`
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
