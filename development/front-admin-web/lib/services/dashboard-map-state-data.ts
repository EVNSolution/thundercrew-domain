import {
  type FrontendDashboardMapState,
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import { generatePinsForUntrackedVehicles } from "@/lib/services/dashboard-dummy-bikes";

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
 * 등록된 차량 중 텔레메트리 핀이 없는 차량에 대해 시뮬레이션 좌표를
 * 생성해서 합친다. 실제 텔레메트리가 들어오면 자동으로 건너뛴다.
 */
async function withSimulatedPins(
  state: FrontendDashboardMapState,
  client: Awaited<ReturnType<typeof createAuthenticatedServiceOpsApiClient>>
): Promise<FrontendDashboardMapState> {
  if (!client) return state;

  try {
    const vehiclePage = await client.listVehicles({ page: 0, size: 200 });
    const totalRegistered = vehiclePage.page.totalItems;
    const existingBikeIds = new Set(state.bikePins.map((p) => p.bikeId));
    const simulated = generatePinsForUntrackedVehicles(vehiclePage.items, existingBikeIds);

    const bikePins = [...state.bikePins, ...simulated];
    const lowBatteryDelta = simulated.filter(
      (pin) => typeof pin.batteryPercent === "number" && pin.batteryPercent <= 20
    ).length;

    return {
      ...state,
      bikePins,
      summary: {
        ...state.summary,
        totalBikes: totalRegistered,
        bikePinCount: bikePins.length,
        onlineBikeCount: state.summary.onlineBikeCount + simulated.length,
        lowBatteryBikeCount: state.summary.lowBatteryBikeCount + lowBatteryDelta
      }
    };
  } catch {
    return state;
  }
}

export async function loadDashboardMapState(): Promise<DashboardMapStateResult> {
  if (!serviceOpsApiConfigured()) {
    return {
      data: emptyMapState(),
      source: "mock"
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
    const enriched = await withSimulatedPins(data, client);
    return { data: enriched, source: "service-ops" };
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
