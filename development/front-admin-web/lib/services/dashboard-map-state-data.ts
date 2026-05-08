import {
  type FrontendDashboardMapState,
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type DashboardMapStateResult = {
  data: FrontendDashboardMapState;
  source: "service-ops" | "mock";
  notice?: string;
};

const EMPTY_SUMMARY = {
  totalBikes: 0,
  bikePinCount: 0,
  onlineBikeCount: 0,
  signalLostBikeCount: 0,
  parkedOfflineBikeCount: 0,
  lowBatteryBikeCount: 0,
  activeStationCount: 0,
  stationPinCount: 0,
  availableBatteryCount: 0
} as const;

function emptyMapState(): FrontendDashboardMapState {
  return {
    generatedAt: new Date().toISOString(),
    summary: { ...EMPTY_SUMMARY },
    bikePins: [],
    stationPins: []
  };
}

/**
 * Mock fallback when the service-ops API is not configured or the session
 * cookie is missing. The dashboard renders an empty map (no pins) and a
 * notice. We do not fabricate fake bikes/stations because the operator could
 * mistake them for real fleet state — better to show "데이터 없음".
 */
export async function loadDashboardMapState(): Promise<DashboardMapStateResult> {
  if (!serviceOpsApiConfigured()) {
    return {
      data: emptyMapState(),
      source: "mock",
      notice:
        "SERVICE_OPS_API_BASE_URL이 없어 빈 지도를 표시합니다. 백엔드 연결 시 실제 차량/충전소 핀이 표시됩니다."
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      data: emptyMapState(),
      source: "mock",
      notice:
        "서비스 API 세션 쿠키가 없어 빈 지도를 표시합니다. 관리자 로그인 후 실제 백엔드 데이터로 전환됩니다."
    };
  }

  try {
    const data = await client.getDashboardMapState();
    return { data, source: "service-ops" };
  } catch (error) {
    return {
      data: emptyMapState(),
      source: "mock",
      notice: `서비스 API 조회 실패로 빈 지도를 표시합니다.${formatServiceOpsError(error)}`
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
