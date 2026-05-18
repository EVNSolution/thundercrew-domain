import {
  type FrontendDashboardMapState,
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import { dummyBikesEnabled, generateDummyBikePins } from "@/lib/services/dashboard-dummy-bikes";

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
 * SHOW_DUMMY_BIKES=1 일 때 실제 핀 + 더미 핀을 합쳐 돌려준다. 실제
 * bikePins 가 비어 있는 초기/시연 환경에서도 지도 마커가 보이게 하기
 * 위함. summary 의 카운트도 같이 보정해서 KPI 카드와 핀 개수가 어긋나
 * "운영자가 핀은 보이는데 숫자는 0" 같은 불일치를 안 만든다.
 */
function withDummyBikesIfEnabled(state: FrontendDashboardMapState): FrontendDashboardMapState {
  if (!dummyBikesEnabled()) return state;

  const dummy = generateDummyBikePins();
  if (dummy.length === 0) return state;

  const bikePins = [...state.bikePins, ...dummy];
  const onlineDelta = dummy.filter((pin) => pin.connectionStatus === "ONLINE").length;
  const lowBatteryDelta = dummy.filter(
    (pin) => typeof pin.batteryPercent === "number" && pin.batteryPercent <= 20
  ).length;

  return {
    ...state,
    bikePins,
    summary: {
      ...state.summary,
      totalBikes: state.summary.totalBikes + dummy.length,
      bikePinCount: state.summary.bikePinCount + dummy.length,
      onlineBikeCount: state.summary.onlineBikeCount + onlineDelta,
      lowBatteryBikeCount: state.summary.lowBatteryBikeCount + lowBatteryDelta
    }
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
    // Env-less dev/sandbox path - the operator-facing notice ("backend
    // missing, you'll see an empty map") was just dev noise. Other mock
    // branches below (no session, API error) keep their notices because
    // those are operationally meaningful.
    return {
      data: withDummyBikesIfEnabled(emptyMapState()),
      source: "mock"
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      data: withDummyBikesIfEnabled(emptyMapState()),
      source: "mock",
      notice:
        "서비스 API 세션 쿠키가 없어 빈 지도를 표시합니다. 관리자 로그인 후 실제 백엔드 데이터로 전환됩니다."
    };
  }

  try {
    const data = await client.getDashboardMapState();
    return { data: withDummyBikesIfEnabled(data), source: "service-ops" };
  } catch (error) {
    return {
      data: withDummyBikesIfEnabled(emptyMapState()),
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
