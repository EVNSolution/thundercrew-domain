import {
  createAuthenticatedServiceOpsApiClient
} from "@/lib/services/service-ops-session";
import {
  serviceOpsApiConfigured,
  type ServiceOpsMaintenanceItem,
  type ServiceOpsVehicleMaintenanceRecord
} from "@/lib/services/service-ops-api";

/**
 * 차량 상세 floating panel 의 "정비 상태" 섹션이 lazy-fetch 하는 두 list 의
 * 결합 응답. 한 round-trip 으로 catalog + history 를 같이 받아 클라이언트가
 * 두 번 fetch 하지 않게 한다.
 *
 * 미설정 / 미인증 환경에선 둘 다 빈 배열로 — UI 는 "데이터 없음" 으로 fallback.
 */
export type VehicleMaintenanceBundle = {
  items: ReadonlyArray<ServiceOpsMaintenanceItem>;
  records: ReadonlyArray<ServiceOpsVehicleMaintenanceRecord>;
};

const EMPTY_BUNDLE: VehicleMaintenanceBundle = { items: [], records: [] };

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
    const [items, records] = await Promise.all([
      client.listMaintenanceItemsForBike(bikeId),
      client.listMaintenanceRecordsForBike(bikeId)
    ]);
    return { items, records };
  } catch {
    // 조회 실패는 운영자 화면을 깨뜨리지 않게 빈 bundle. console.error 는 backend
    // log 가 잡고, 클라이언트엔 "정비 데이터 불러오기 실패" UI 가 추후 필요.
    return EMPTY_BUNDLE;
  }
}
