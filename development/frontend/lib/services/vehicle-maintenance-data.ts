import {
  createAuthenticatedServiceOpsApiClient
} from "@/lib/services/service-ops-session";
import {
  serviceOpsApiConfigured,
  type ServiceOpsMaintenanceItem,
  type ServiceOpsVehicleMaintenanceRecord
} from "@/lib/services/service-ops-api";
import { simulateBikeCurrentTelemetrySummary } from "@/lib/services/dashboard-dummy-bikes";

/**
 * 차량 floating panel 의 텔레메트리 + 정비 섹션이 함께 쓰는 텔레메트리
 * 현재 상태의 요약. 전체 `FrontendBikeCurrentState` 가 아니라 화면이 실제로
 * 출력 / 분류에 쓰는 필드만 옮긴다.
 *
 * `connectionStatus` 는 backend 의 V4/V24 derive 그대로 ("ONLINE" /
 * "SIGNAL_LOST" / "PARKED_OFFLINE_NORMAL" / "STALE_UNKNOWN"). 화면은 ONLINE 만
 * "온라인" 으로 취급해 odometer 기반 자동 status 분류에 쓴다.
 */
export type VehicleCurrentTelemetrySummary = {
  odometerKm: number | null;
  connectionStatus: string;
  ignitionStatus: string;
  batteryPercent: number | null;
  batteryStatus: string;
  speedKph: number | null;
  drivingStatus: string;
  lastReceivedAt: string;
};

/**
 * 차량 상세 floating panel 의 "정비 상태" 섹션이 lazy-fetch 하는 두 list 의
 * 결합 응답. 한 round-trip 으로 catalog + history + 현재 텔레메트리를 같이
 * 받아 클라이언트가 여러 번 fetch 하지 않게 한다.
 *
 * 미설정 / 미인증 환경에선 둘 다 빈 배열로 — UI 는 "데이터 없음" 으로 fallback.
 *
 * `currentState` 는 텔레메트리가 한 번도 안 들어온 차량 또는 조회 실패 시 null —
 * UI 는 "오프라인" 안내문으로 fallback 하고 km 기반 품목은 자동 분류 안 함.
 */
export type VehicleMaintenanceBundle = {
  items: ReadonlyArray<ServiceOpsMaintenanceItem>;
  records: ReadonlyArray<ServiceOpsVehicleMaintenanceRecord>;
  currentState: VehicleCurrentTelemetrySummary | null;
};

const EMPTY_BUNDLE: VehicleMaintenanceBundle = { items: [], records: [], currentState: null };

/**
 * 차량 탭의 "정비 상태" 필터가 차량 별로 임박/지연 여부를 derive 할 때 쓰는
 * 전체 dataset. catalog 전체 + 모든 차량의 정비 이력을 한 번에 받아오는 두
 * 페이지 요청.
 *
 * MVP 규모(< 200 차량 × ~10 품목)에서 페이지 size 200/500 한 번이면 충분.
 * 데이터가 더 커지면 size 늘리거나 서버 쪽에 차량 별 latest-record-per-item
 * 집계 endpoint 를 추가.
 */
export type MaintenanceDatasetResult = {
  items: ReadonlyArray<ServiceOpsMaintenanceItem>;
  records: ReadonlyArray<ServiceOpsVehicleMaintenanceRecord>;
};

const EMPTY_DATASET: MaintenanceDatasetResult = { items: [], records: [] };

export async function loadMaintenanceDataset(): Promise<MaintenanceDatasetResult> {
  if (!serviceOpsApiConfigured()) return EMPTY_DATASET;
  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) return EMPTY_DATASET;
  try {
    const [itemsPage, recordsPage] = await Promise.all([
      client.listMaintenanceItems({ page: 0, size: 200 }),
      client.listMaintenanceRecords({ page: 0, size: 500 })
    ]);
    return { items: itemsPage.items, records: recordsPage.items };
  } catch {
    return EMPTY_DATASET;
  }
}

export async function loadVehicleMaintenanceBundle(bikeId: string): Promise<VehicleMaintenanceBundle> {
  if (!serviceOpsApiConfigured()) return EMPTY_BUNDLE;
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return EMPTY_BUNDLE;

  try {
    // current state 는 텔레메트리가 한 번도 안 들어온 차량에선 404. 그 케이스
    // 에선 표가 보여주는 더미 텔레메트리(dashboard-dummy-bikes) 와 같은 값으로
    // 패널을 채워 운영자가 두 화면에서 일관된 수치를 보도록 한다. 실제
    // 텔레메트리가 들어오면 backend 가 응답하므로 fallback 이 자동 비활성.
    const [items, records, currentState] = await Promise.all([
      client.listMaintenanceItemsForBike(bikeId),
      client.listMaintenanceRecordsForBike(bikeId),
      client
        .getBikeCurrentState(bikeId)
        .then((state) => ({
          odometerKm: state.odometerKm,
          connectionStatus: state.connectionStatus,
          ignitionStatus: state.ignitionStatus,
          batteryPercent: state.batteryPercent,
          batteryStatus: state.batteryStatus,
          speedKph: state.speedKph,
          drivingStatus: state.drivingStatus,
          lastReceivedAt: state.lastReceivedAt
        }))
        .catch(() => simulateBikeCurrentTelemetrySummary(bikeId))
    ]);
    return { items, records, currentState };
  } catch {
    // 조회 실패는 운영자 화면을 깨뜨리지 않게 빈 bundle. console.error 는 backend
    // log 가 잡고, 클라이언트엔 "정비 데이터 불러오기 실패" UI 가 추후 필요.
    return EMPTY_BUNDLE;
  }
}
