import { redirect } from "next/navigation";

import type { InsuranceOption } from "@/components/management/RidersPanel";
import { FullscreenMapHost } from "@/components/overview/FullscreenMapHost";
import { OverviewClientShell } from "@/components/overview/OverviewClientShell";
import { loadDashboardMapState } from "@/lib/services/dashboard-map-state-data";
import { loadRiderList } from "@/lib/services/rider-data";
import { loadRiderMatchingSnapshot } from "@/lib/services/rider-matching-snapshot-data";
import {
  createAuthenticatedServiceOpsApiClient,
  serviceOpsSessionReady
} from "@/lib/services/service-ops-session";
import {
  serviceOpsApiConfigured,
  type ServiceOpsContractTemplate,
  type ServiceOpsInsuranceItem,
  type ServiceOpsMaintenanceCategory,
  type ServiceOpsRiderBikeContract,
  type ServiceOpsRiderInsurance
} from "@/lib/services/service-ops-api";
import { loadStationList } from "@/lib/services/station-data";
import { loadVehicleList } from "@/lib/services/vehicle-data";
import { loadMaintenanceDataset } from "@/lib/services/vehicle-maintenance-data";
import { summarizeMaintenanceByBike } from "@/components/management/vehicle-maintenance-derive";

// Authenticated, per-admin loader. At build time the env-less mock fallback
// returns synchronously without touching cookies, which lets Next.js
// statically prerender the page. In production that would freeze the
// output across all admins, so we opt in to dynamic rendering explicitly.
export const dynamic = "force-dynamic";

/**
 * 운영 콘솔의 단일 진입 페이지. 예전엔 `/` → `/overview` 우회 redirect 가
 * 있었지만, 운영 콘솔이 단일 화면으로 통합되면서 그 우회는 단순한
 * 페이지 로드 지연을 만들 뿐 의미가 없어졌다. 그래서 overview 의 본문을
 * 그대로 루트로 끌어왔고, `/overview` 는 backward-compat 용 redirect 만
 * 남겨둔다.
 *
 * 미로그인 상태 진입은 `/login` 으로 즉시 보낸다. 미들웨어가 같은 가드를
 * 이미 적용하지만, 페이지 단위에서도 한 번 더 막아 두는 게 환경 변수
 * 변동에 강건하다 (`serviceOpsApiConfigured() === false` 환경에선 미들
 * 웨어 통과 후 실제 데이터 fetch 가 mock 으로 떨어지는 경로가 있어서).
 */
export default async function RootPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const sessionActive = await serviceOpsSessionReady();
  if (!sessionActive) {
    redirect("/login");
  }
  // Always fetch the cross-tab datasets so the panels can fill the lookup
  // columns and KPI tiles without a second round-trip on tab switch.
  const [
    { tab: tabParam },
    mapState,
    riderData,
    vehicleData,
    matching,
    opsExtra,
    maintenanceData,
    stationData
  ] = await Promise.all([
    searchParams,
    loadDashboardMapState(),
    loadRiderList(),
    loadVehicleList(),
    loadRiderMatchingSnapshot(),
    loadContractsAndInsurances(),
    loadMaintenanceDataset(),
    loadStationList()
  ]);

  // `tabParam` 은 더 이상 페이지에서 탭을 분기하지 않지만, 하위 호환을 위해
  // searchParams 시그니처에는 남겨둔다. (하단 패널의 탭은 클라이언트 state.)
  void tabParam;

  // Per-bike plate lookup for the fullscreen map panel.
  const plateByBikeId = new Map<string, string>();
  for (const vehicle of vehicleData.vehicles) {
    plateByBikeId.set(vehicle.id ?? vehicle.slug, vehicle.plateNumber);
  }
  // riderId → plate for that rider's active bike (single entry per rider
  // because matching keeps one active contract per rider).
  const riderActiveBikePlate = new Map<string, string>();
  // riderId → bikeId of that rider's active bike. 라이더 상세 다이얼로그가
  // 시동 상태 / 시동 방지 lookup 에 사용. bikeActiveRiderById 의 역방향 인덱스.
  const riderActiveBikeId = new Map<string, string>();
  for (const [bikeId, riderId] of matching.bikeActiveRiderById) {
    const plate = plateByBikeId.get(bikeId);
    if (plate) riderActiveBikePlate.set(riderId, plate);
    riderActiveBikeId.set(riderId, bikeId);
  }

  // riderId → { name, phone } for the vehicles panel's 이름 + 연락처
  // columns (lookup pivots on bikeActiveRiderById in VehiclesPanel).
  const riderInfoById = new Map<string, { name: string; phone: string }>();
  for (const rider of riderData.riders) {
    riderInfoById.set(rider.id ?? rider.slug, { name: rider.name, phone: rider.phone });
  }

  // riderId → 라이더 보험 자유 텍스트(기본/추가). 차량 상세 패널 + 하단 차량
  // 패널 보험 컬럼이 이 맵으로 텍스트를 표시한다 (legacy catalog 대체).
  const riderInsuranceById = new Map<string, { primaryInsurance: string | null; addonInsurance: string | null }>();
  for (const rider of riderData.riders) {
    riderInsuranceById.set(rider.id ?? rider.slug, {
      primaryInsurance: rider.primaryInsurance ?? null,
      addonInsurance: rider.addonInsurance ?? null
    });
  }

  // riderId → 활성(enabled) rider_insurance 한 건. 라이더 수정 다이얼로그의
  // "보험" select 가 현재 선택을 표시할 때 + 변경 시 옛 row 를 삭제할 때 참고.
  const riderActiveInsuranceByRiderId = new Map<string, ServiceOpsRiderInsurance>();
  for (const insurance of opsExtra.insurances) {
    if (!insurance.enabled) continue;
    if (!riderActiveInsuranceByRiderId.has(insurance.riderId)) {
      riderActiveInsuranceByRiderId.set(insurance.riderId, insurance);
    }
  }
  // riderId → 활성 rider_insurance 전체 목록. 차량 상세 패널의 PRIMARY + ADDON
  // 분리 보험 편집에 사용 (라이더당 여러 보험 가능).
  const riderAllInsurancesByRiderId = new Map<string, ServiceOpsRiderInsurance[]>();
  for (const insurance of opsExtra.insurances) {
    if (!insurance.enabled) continue;
    const list = riderAllInsurancesByRiderId.get(insurance.riderId) ?? [];
    list.push(insurance);
    riderAllInsurancesByRiderId.set(insurance.riderId, list);
  }
  // insurance_item id → item. PRIMARY/ADDON 분류 + 차량 상세 패널 보험 섹션 lookup.
  const insuranceItemById = new Map<string, ServiceOpsInsuranceItem>();
  for (const item of opsExtra.insuranceItems) {
    insuranceItemById.set(item.id, item);
  }

  // 라이더 수정 다이얼로그 + 차량 상세 패널 보험 편집에 쓰는 옵션 목록 (active 항목만).
  // category 포함 → PRIMARY(기본보험) / ADDON(추가보험) 분리 표시.
  const insuranceOptions: InsuranceOption[] = opsExtra.insuranceItems.map((item) => ({
    id: item.id,
    label: item.name,
    category: item.category
  }));

  // 라이더 상세 다이얼로그의 "시동 상태" 표시가 참고할 telemetry 상태 맵.
  // UNKNOWN / 데이터 없음은 맵에서 빠지고 다이얼로그가 "—" 로 폴백.
  const ignitionStatusByBikeId = new Map<string, string>();
  for (const pin of mapState.data.bikePins) {
    ignitionStatusByBikeId.set(pin.bikeId, pin.ignitionStatus);
  }
  // 차량 탭 "정비 상태" 필터가 임박/지연 차량을 골라낼 때 참조. bikeId →
  // {hasOverdue, hasDueSoon, overallStatus}. 차량별 wheelType + engineType 으로
  // 단일 ServiceOpsMaintenanceCategory 를 결정해 catalog × records 를 derive.
  const bikeCategoryById = new Map<string, ServiceOpsMaintenanceCategory>();
  for (const vehicle of vehicleData.vehicles) {
    if (vehicle.id) bikeCategoryById.set(vehicle.id, bikeCategory(vehicle.wheelType, vehicle.engineType));
  }
  const maintenanceSummaryByBike = summarizeMaintenanceByBike(
    maintenanceData.items,
    maintenanceData.records,
    bikeCategoryById
  );

  // 시뮬레이션 대상 식별: 차량 IMEI(Bike.imei) 가 "-" 로 시작하면 가상(시뮬)
  // 차량으로 본다. 실제 IMEI 는 15자리 숫자라 "-" 와 절대 겹치지 않으므로,
  // 운영자가 자원 관리/엑셀에서 IMEI 를 "-1" 등으로 넣은 차량만 시뮬 후보다.
  // IMEI 가 비어 있는(미등록) 실차는 매칭되어도 시뮬되지 않는다.
  const imeiMinusOneBikeIds: string[] = [];
  for (const vehicle of vehicleData.vehicles) {
    if (vehicle.id && vehicle.imei && vehicle.imei.startsWith("-")) {
      imeiMinusOneBikeIds.push(vehicle.id);
    }
  }

  // 활성 라이더-차량 매칭을 직렬화 가능한 배열로 변환.
  // RSC → client component JSON boundary 를 넘기 위해 배열로.
  const bikeRiderPairs: [string, string][] = [...matching.bikeActiveRiderById.entries()];

  return (
    <div className="page-container page-container--fullscreen">
      {mapState.notice ? (
        <p className="notice" role="status">
          {mapState.notice}
        </p>
      ) : null}

      <OverviewClientShell
        imeiMinusOneBikeIds={imeiMinusOneBikeIds}
        bikeRiderPairs={bikeRiderPairs}
      >
        <FullscreenMapHost
          bikePins={mapState.data.bikePins}
          stationPins={mapState.data.stationPins}
          tipPins={mapState.data.tips}
          vehicles={vehicleData.vehicles}
          riders={riderData.riders}
          stations={stationData.stations}
          bikeActiveRiderById={matching.bikeActiveRiderById}
          riderInfoById={riderInfoById}
          maintenanceSummaryByBike={maintenanceSummaryByBike}
          educationTypeByRiderId={matching.educationTypeByRiderId}
          riderActiveBikeId={riderActiveBikeId}
          riderActiveBikePlate={riderActiveBikePlate}
          riderActiveContractById={matching.riderActiveContractById}
          insuredRiderIds={matching.insuredRiderIds}
          ignitionStatusByBikeId={ignitionStatusByBikeId}
          riderAllInsurancesByRiderId={riderAllInsurancesByRiderId}
          insuranceItemById={insuranceItemById}
          insuranceOptions={insuranceOptions}
          riderInsuranceById={riderInsuranceById}
          vehicleData={vehicleData}
          stationData={stationData}
          riderActiveInsuranceByRiderId={riderActiveInsuranceByRiderId}
        />
      </OverviewClientShell>
    </div>
  );
}

/** wheelType + engineType 두 값을 단일 ServiceOpsMaintenanceCategory 로 변환.
 *  미입력 / 알 수 없는 값은 TWO_WHEEL_ELECTRIC (가장 흔한 차종) 으로 fallback. */
function bikeCategory(
  wheel: string | null | undefined,
  engine: string | null | undefined
): ServiceOpsMaintenanceCategory {
  const four = wheel === "FOUR_WHEEL";
  const ice = engine === "ICE";
  if (four) return ice ? "FOUR_WHEEL_ICE" : "FOUR_WHEEL_ELECTRIC";
  return ice ? "TWO_WHEEL_ICE" : "TWO_WHEEL_ELECTRIC";
}

// 계약/보험 섹션이 쓰는 부수 데이터(목록 + 양식·상품 사전) 를 한 번에
// 로드. 백엔드가 닫혀있거나 실패하면 모든 배열이 비어 있는 fallback 으로
// 떨어진다 — 운영자 화면이 깨지지 않게 한다.
async function loadContractsAndInsurances(): Promise<{
  contracts: ReadonlyArray<ServiceOpsRiderBikeContract>;
  insurances: ReadonlyArray<ServiceOpsRiderInsurance>;
  templates: ReadonlyArray<ServiceOpsContractTemplate>;
  insuranceItems: ReadonlyArray<ServiceOpsInsuranceItem>;
}> {
  const empty = { contracts: [], insurances: [], templates: [], insuranceItems: [] };
  if (!serviceOpsApiConfigured()) return empty;
  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) return empty;
  try {
    const [contractsPage, insurancesPage, templatesPage, insuranceItemsPage] = await Promise.all([
      client.listRiderBikeContracts({ page: 0, size: 200 }),
      client.listRiderInsurances({ page: 0, size: 200 }),
      client.listContractTemplates({ page: 0, size: 200 }),
      client.listInsuranceItems({ page: 0, size: 200 })
    ]);
    return {
      // 진행 중인 매칭만 노출 — terminatedAt 채워진 행은 별도 이력 뷰가 생길 때 보여줌.
      contracts: contractsPage.items.filter((row) => !row.terminatedAt),
      insurances: insurancesPage.items,
      templates: templatesPage.items.filter((row) => row.enabled !== false),
      insuranceItems: insuranceItemsPage.items.filter((row) => row.enabled !== false)
    };
  } catch {
    return empty;
  }
}
