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
    stationPins: [],
    tips: []
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
    const rawSimulated = generatePinsForUntrackedVehicles(vehiclePage.items, existingBikeIds);

    // CLEANING 차량의 다음 고객 좌표를 주입한다. 텔레메트리가 없는 차량도
    // bike_next_customer 에 데이터가 있을 수 있으므로 개별 조회 후 병합.
    const simulated = await Promise.all(
      rawSimulated.map(async (pin) => {
        if (pin.serviceType !== "CLEANING") return pin;
        try {
          const nc = await client.getBikeNextCustomer(pin.bikeId);
          if (nc) {
            return { ...pin, nextCustomerLat: nc.latitude, nextCustomerLng: nc.longitude,
                     nextCustomerName: nc.customerName, nextCustomerPhone: nc.customerPhone };
          }
        } catch {
          // 조회 실패 시 원본 pin 사용
        }
        return pin;
      })
    );

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
