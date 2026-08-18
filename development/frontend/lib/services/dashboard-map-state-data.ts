import {
  type FrontendDashboardMapState,
  type ServiceOpsApiError,
  type ServiceOpsDispatchOrder,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { isCleaningPurpose } from "@/lib/services/fleet-simulation";
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
  availableBatteryCount: 0
} as const;

function emptyMapState(): FrontendDashboardMapState {
  return {
    generatedAt: new Date().toISOString(),
    summary: { ...EMPTY_SUMMARY },
    bikePins: [],
  };
}

/**
 * 시뮬 대상 차량(IMEI가 "-" 로 시작)에 한해 텔레메트리 핀이 없을 때 시뮬레이션
 * 좌표를 생성해 합친다. 실제 단말 차량(숫자 IMEI)·IMEI 없는 차량은 합성하지
 * 않으므로, 단말 미연동 차량의 가짜 위치가 지도에 뜨지 않는다.
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

    // 합성 핀(텔레메트리 없는 차량)은 currentDispatch* 가 null 로 생성된다.
    // 백엔드 대시보드 핀과 달리 배차가 안 실리므로, 활성(ASSIGNED) 배차를 한 번
    // 조회해 bikeId → 최저 sequence 주문 맵을 만들어 주입한다. 이게 없으면 지도에
    // 배차 목적지가 안 뜨고, 청소형 시뮬도 다음 목적지를 못 받아 출발하지 않는다.
    const dispatchByBike = new Map<string, ServiceOpsDispatchOrder>();
    const dispatchCountByBike = new Map<string, number>();
    try {
      const active = await client.listActiveDispatchOrders();
      for (const order of active) {
        if (order.status !== "ASSIGNED" || !order.bikeId) continue;
        dispatchCountByBike.set(order.bikeId, (dispatchCountByBike.get(order.bikeId) ?? 0) + 1);
        const cur = dispatchByBike.get(order.bikeId);
        if (!cur || order.sequence < cur.sequence) dispatchByBike.set(order.bikeId, order);
      }
    } catch {
      // 배차 조회 실패 시 currentDispatch 주입 없이 진행
    }

    // CLEANING 차량의 다음 고객 좌표(bike_next_customer)도 개별 조회 후 병합.
    const simulated = await Promise.all(
      rawSimulated.map(async (rawPin) => {
        // 1) 현재 배차(ASSIGNED 최저 sequence) 좌표 주입 — 차종 무관(지도 표시 + 시뮬).
        const order = dispatchByBike.get(rawPin.bikeId);
        const pin = order
          ? {
              ...rawPin,
              currentDispatchCustomerName: order.customerName,
              currentDispatchAddress: order.address,
              currentDispatchLatitude: order.latitude,
              currentDispatchLongitude: order.longitude,
              currentDispatchKind: order.kind ?? "DELIVERY",
              dispatchQueueCount: dispatchCountByBike.get(rawPin.bikeId) ?? 0
            }
          : rawPin;
        // 2) 청소형은 다음 고객 좌표도 병합.
        if (!isCleaningPurpose(pin.purpose)) return pin;
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
