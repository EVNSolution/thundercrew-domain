import { getMockNcpMapEnabled } from "@/lib/services/admin-preferences-mock-store";
import {
  type ServiceOpsAdminPreferences,
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type AdminPreferencesResult = {
  data: ServiceOpsAdminPreferences | null;
  source: "service-ops" | "mock";
  notice?: string;
};

const DEFAULT_NCP_MAP_ENABLED = true;

/**
 * Loader for the per-admin runtime preferences. Used by the dashboard page
 * (to thread the NCP map toggle into MapShell as a prop) and the settings
 * page (to render the toggle widget). Mirrors the rider/contract loader
 * pattern: returns a plausible fallback on every failure path so the
 * caller never crashes.
 *
 * <p>Fallback semantics: when service-ops is not configured, the operator
 * is logged out, or the API rejects the call, the loader synthesises a
 * preferences row with `ncpMapEnabled = true`. That keeps the dashboard
 * looking like the production deploy (where a logged-out operator never
 * gets that far in the first place) and avoids accidentally hiding the
 * map for a real operator whose session expired mid-session.</p>
 */
export async function loadAdminPreferences(): Promise<AdminPreferencesResult> {
  if (!serviceOpsApiConfigured()) {
    // Dev-only fallback: read the toggle from the in-memory mock store
    // so the settings page can flip it visibly without a real backend.
    // The store resets to ON on dev-server restart (HMR-safe via globalThis).
    return {
      data: { adminId: "mock", ncpMapEnabled: getMockNcpMapEnabled() },
      source: "mock",
      notice:
        "SERVICE_OPS_API_BASE_URL이 없어 dev 프로세스 메모리에만 토글 값을 임시 저장합니다. 서버를 재시작하면 기본값(ON) 으로 초기화됩니다."
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      data: { adminId: "mock", ncpMapEnabled: DEFAULT_NCP_MAP_ENABLED },
      source: "mock",
      notice: "관리자 세션이 없어 설정을 불러올 수 없습니다."
    };
  }

  try {
    const data = await client.getAdminPreferences();
    return { data, source: "service-ops" };
  } catch (error) {
    return {
      data: { adminId: "mock", ncpMapEnabled: DEFAULT_NCP_MAP_ENABLED },
      source: "mock",
      notice: `어드민 설정 조회 실패.${formatServiceOpsError(error)}`
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
