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
