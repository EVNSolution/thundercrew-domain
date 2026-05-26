import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ContractMatchingForm, type ContractMatchingOption } from "@/components/management/ContractMatchingForm";
import { CreateMaintenanceItemDialog } from "@/components/management/CreateMaintenanceItemDialog";
import { CreateRiderDialog } from "@/components/management/CreateRiderDialog";
import { CreateStationDialog } from "@/components/management/CreateStationDialog";
import { CreateVehicleDialog } from "@/components/management/CreateVehicleDialog";
import { MaintenancePanel } from "@/components/management/MaintenancePanel";
import { RidersPanel, type InsuranceOption } from "@/components/management/RidersPanel";
import { StationsPanel } from "@/components/management/StationsPanel";
import { VehiclesPanel } from "@/components/management/VehiclesPanel";
import { FullscreenMapHost } from "@/components/overview/FullscreenMapHost";
import { OverviewClientShell } from "@/components/overview/OverviewClientShell";
import { OverviewKpiTiles } from "@/components/overview/OverviewKpiTiles";
import { OverviewMapBanner } from "@/components/overview/OverviewMapBanner";
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
  type ServiceOpsRiderBikeContract,
  type ServiceOpsRiderInsurance
} from "@/lib/services/service-ops-api";
import { loadStationList } from "@/lib/services/station-data";
import { loadVehicleList } from "@/lib/services/vehicle-data";
import { loadVehicleDeviceMap } from "@/lib/services/vehicle-device-data";
import { loadMaintenanceDataset } from "@/lib/services/vehicle-maintenance-data";
import { summarizeMaintenanceByBike } from "@/components/management/vehicle-maintenance-derive";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { NotificationProvider } from "@/components/layout/NotificationContext";

// Authenticated, per-admin loader. At build time the env-less mock fallback
// returns synchronously without touching cookies, which lets Next.js
// statically prerender the page. In production that would freeze the
// output across all admins, so we opt in to dynamic rendering explicitly.
export const dynamic = "force-dynamic";

type TabKey = "vehicles" | "riders" | "stations" | "maintenance";

type TabConfig = {
  key: TabKey;
  label: string;
};

// 운영팀 요청 — 1순위 화면이 차량 관리이므로 차량 탭이 첫 번째이자 기본.
// stations 키는 유지하되 라벨만 "BSS"(Battery Swap Station)로 노출한다.
// maintenance 는 정비 카탈로그 편집 전용 — 평소엔 거의 안 열리지만 운영자가
// default cycle / 신규 품목을 추가할 때 사용.
const TABS: ReadonlyArray<TabConfig> = [
  { key: "vehicles", label: "차량" },
  { key: "riders", label: "라이더" },
  { key: "stations", label: "BSS" },
  { key: "maintenance", label: "정비" }
];

const numberFormatter = new Intl.NumberFormat("ko-KR");

function formatCount(value: number): string {
  return numberFormatter.format(value);
}

function isValidTabKey(value: string | undefined): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

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
  // `deviceMap` 은 차량 테이블의 IMEI 컬럼을 N+1 호출 없이 한 번에 채우는
  // batch lookup. installations + devices 두 list 를 조인해 bikeId → deviceUid
  // 사전 한 장으로 내려준다.
  const [
    { tab: tabParam, status: statusParam },
    mapState,
    riderData,
    vehicleData,
    matching,
    opsExtra,
    deviceMap,
    maintenanceData,
    stationData
  ] = await Promise.all([
    searchParams,
    loadDashboardMapState(),
    loadRiderList(),
    loadVehicleList(),
    loadRiderMatchingSnapshot(),
    loadContractsAndInsurances(),
    loadVehicleDeviceMap(),
    loadMaintenanceDataset(),
    loadStationList()
  ]);

  const activeTab: TabKey = isValidTabKey(tabParam) ? tabParam : "vehicles";
  const summary = mapState.data.summary;
  const totalRiders = riderData.riders.length;

  // Per-bike plate lookup for the riders panel's 차량 번호 column.
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

  // 신규 매칭 다이얼로그의 select 옵션. id 와 사용자에게 보일 라벨만 노출.
  const riderOptions: ContractMatchingOption[] = riderData.riders
    .filter((rider) => Boolean(rider.id))
    .map((rider) => ({ id: rider.id ?? rider.slug, label: `${rider.name} (${rider.phone})` }));
  const vehicleOptions: ContractMatchingOption[] = vehicleData.vehicles
    .filter((vehicle) => Boolean(vehicle.id))
    .map((vehicle) => ({
      id: vehicle.id ?? vehicle.slug,
      label: `${vehicle.plateNumber}${vehicle.model ? ` · ${vehicle.model}` : ""}`
    }));
  const templateOptions: ContractMatchingOption[] = opsExtra.templates.map((template) => ({
    id: template.id,
    label: template.name
  }));
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
  // 라이더 상세 다이얼로그의 "시동 방지" 토글이 현재 상태를 보여주는 데
  // 쓰는 맵. ServiceOpsBike 응답에 `ignitionBlocked` 가 있으면 그걸 그대로.
  const ignitionBlockedByBikeId = new Map<string, boolean>();
  for (const vehicle of vehicleData.vehicles) {
    if (vehicle.id) ignitionBlockedByBikeId.set(vehicle.id, vehicle.ignitionBlocked ?? false);
  }

  // 차량 탭 "정비 상태" 필터가 임박/지연 차량을 골라낼 때 참조. bikeId →
  // {hasOverdue, hasDueSoon, overallStatus}. 차량별 engineType 으로 적용
  // catalog 를 분기해 catalog × records 의 매트릭스를 한 번에 derive.
  const bikeEngineTypeById = new Map<string, "ELECTRIC" | "ICE">();
  for (const vehicle of vehicleData.vehicles) {
    if (vehicle.id) bikeEngineTypeById.set(vehicle.id, vehicle.engineType ?? "ELECTRIC");
  }
  const maintenanceSummaryByBike = summarizeMaintenanceByBike(
    maintenanceData.items,
    maintenanceData.records,
    bikeEngineTypeById
  );

  // IMEI=-1 차량 식별: deviceUid 가 "-1" 이거나 "-1-" 으로 시작하는 bikeId 를 추출.
  // "-1-{prefix}" 형식은 차량별 독립 가상 단말기를 위해 고유하게 생성된 uid.
  // 실제 IMEI 는 15자리 숫자라서 "-1" 패턴과 절대 겹치지 않음.
  // ▶ ignitionOnCount 보다 먼저 계산 — 이중 카운팅 방지를 위한 필터에 사용.
  const imeiMinusOneBikeIds: string[] = [];
  const imeiMinusOneSet = new Set<string>();
  for (const [bikeId, uid] of deviceMap.deviceUidByBikeId) {
    if (uid === "-1" || uid.startsWith("-1-")) {
      imeiMinusOneBikeIds.push(bikeId);
      imeiMinusOneSet.add(bikeId);
    }
  }

  // 시동 차량(실제 차량분) — API 연동 완료 후 실 텔레메트리 값으로 채움.
  // 현재는 API 미연동 상태라 실제 차량의 ignitionStatus 신뢰 불가 → 0 고정.
  // IMEI=-1 차량은 OverviewKpiTiles 가 simulatedIgnitionOn 으로 별도 카운트.
  // TODO: API 연동 후 아래 값을 실 텔레메트리 기반으로 교체.
  //   const ignitionOnCount = mapState.data.bikePins.filter(
  //     (pin) => pin.ignitionStatus === "ON" && !imeiMinusOneSet.has(pin.bikeId)
  //   ).length;
  const ignitionOnCount = 0;

  // 활성 라이더-차량 매칭을 직렬화 가능한 배열로 변환.
  // RSC → client component JSON boundary 를 넘기 위해 배열로.
  const bikeRiderPairs: [string, string][] = [...matching.bikeActiveRiderById.entries()];

  // 보험 차량 = 그 차량의 활성 라이더가 보험에 가입되어 있는 경우만 카운트.
  // (vehicleId → riderId map 의 riderId 가 insuredRiderIds 에 포함되는지 검사.)
  let insuredVehicleCount = 0;
  for (const [, riderId] of matching.bikeActiveRiderById) {
    if (matching.insuredRiderIds.has(riderId)) {
      insuredVehicleCount++;
    }
  }

  // 라이더 측 KPI — 현재 활성 계약의 category 별 인원수. 매칭 스냅샷이 라이더당
  // 활성 계약 한 건만 보유하므로 단순 합산이 곧 인원수.
  let subscriptionRiderCount = 0;
  let rentalRiderCount = 0;
  for (const contract of matching.riderActiveContractById.values()) {
    if (contract.category === "SUBSCRIPTION") subscriptionRiderCount++;
    else if (contract.category === "RENTAL") rentalRiderCount++;
  }

  // Reuse the rider data we already fetched for the KPI calculations when
  // the active tab is also 라이더, so we don't pay a second round-trip.
  // Pass the matching sets to the panel so the 계약 / 보험 columns can
  // render real "있음/없음" badges instead of fallback dashes.
  const activeContent: { panel: ReactNode; notice: string | undefined } =
    activeTab === "riders"
      ? {
          panel: (
            <RidersPanel
              data={riderData}
              insuredRiderIds={matching.insuredRiderIds}
              educationTypeByRiderId={matching.educationTypeByRiderId}
              riderActiveContractById={matching.riderActiveContractById}
              riderActiveBikePlate={riderActiveBikePlate}
              riderActiveBikeId={riderActiveBikeId}
              riderActiveInsuranceByRiderId={riderActiveInsuranceByRiderId}
              insuranceOptions={insuranceOptions}
              ignitionStatusByBikeId={ignitionStatusByBikeId}
              ignitionBlockedByBikeId={ignitionBlockedByBikeId}
            />
          ),
          notice: riderData.notice
        }
      : activeTab === "vehicles"
        ? {
            panel: (
              <VehiclesPanel
                data={vehicleData}
                bikeActiveRiderById={matching.bikeActiveRiderById}
                riderInfoById={riderInfoById}
                bikePins={mapState.data.bikePins}
                deviceUidByBikeId={deviceMap.deviceUidByBikeId}
                educationTypeByRiderId={matching.educationTypeByRiderId}
                riderActiveContractById={matching.riderActiveContractById}
                riderActiveInsuranceByRiderId={riderActiveInsuranceByRiderId}
                insuranceOptions={insuranceOptions}
                ignitionBlockedByBikeId={ignitionBlockedByBikeId}
                maintenanceSummaryByBike={maintenanceSummaryByBike}
                statusParam={statusParam}
              />
            ),
            notice: vehicleData.notice
          }
        : activeTab === "maintenance"
          ? {
              panel: <MaintenancePanel items={maintenanceData.items} />,
              notice: undefined
            }
          : await loadOtherTabContent(activeTab);

  return (
    <NotificationProvider>
      <div className="page-container">
      {mapState.notice ? (
        <p className="notice" role="status">
          {mapState.notice}
        </p>
      ) : null}

      <OverviewClientShell
        imeiMinusOneBikeIds={imeiMinusOneBikeIds}
        bikeRiderPairs={bikeRiderPairs}
      >
      {/* 페이지 상단 KPI 두 카드(차량 현황 / 라이더 현황). */}
      <OverviewKpiTiles
        totalBikes={summary.totalBikes}
        ignitionOnCount={ignitionOnCount}
        insuredVehicleCount={insuredVehicleCount}
        totalRiders={totalRiders}
        subscriptionRiderCount={subscriptionRiderCount}
        rentalRiderCount={rentalRiderCount}
      />

      {/* 지도 보기 토글 + 캔버스는 KPI 와 탭(관리 섹션) 사이에 위치. 운영자가
          숫자 → 지도 → 표로 자연스럽게 눈을 내려갈 수 있도록 한 단계 정렬. */}
      <OverviewMapBanner
        bikePins={mapState.data.bikePins}
        stationPins={mapState.data.stationPins}
        vehicles={vehicleData.vehicles}
        bikeActiveRiderById={matching.bikeActiveRiderById}
        riderInfoById={riderInfoById}
        riderAllInsurancesByRiderId={riderAllInsurancesByRiderId}
        insuranceItemById={insuranceItemById}
        insuranceOptions={insuranceOptions}
      />
      <FullscreenMapHost
        bikePins={mapState.data.bikePins}
        stationPins={mapState.data.stationPins}
        vehicles={vehicleData.vehicles}
        riders={riderData.riders}
        stations={stationData.stations}
        bikeActiveRiderById={matching.bikeActiveRiderById}
        riderInfoById={riderInfoById}
        deviceUidByBikeId={deviceMap.deviceUidByBikeId}
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
      />

      <h2 className="overview-section-heading">관리</h2>
      <div className="overview-tabs-row">
        <nav className="overview-tabs" aria-label="도메인 관리 탭">
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <Link
                key={tab.key}
                className={`overview-tab${isActive ? " is-active" : ""}`}
                href={`/?tab=${tab.key}`}
                aria-current={isActive ? "page" : undefined}
                // scroll={false} preserves the current scroll position so the
                // operator stays at the tab row when switching domains -
                // otherwise every tab click jumps back to the top of the page
                // because Next.js's default Link behaviour resets scroll on
                // every navigation.
                scroll={false}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <div className="overview-tab-action">
          {activeTab === "riders" ? <CreateRiderDialog /> : null}
          {activeTab === "vehicles" ? <CreateVehicleDialog /> : null}
          {activeTab === "stations" ? <CreateStationDialog /> : null}
          {activeTab === "maintenance" ? <CreateMaintenanceItemDialog parentOptions={maintenanceData.items} /> : null}
          <NotificationBell />
        </div>
      </div>

      {activeContent.notice ? (
        <p className="notice" role="status">
          {activeContent.notice}
        </p>
      ) : null}

      {activeContent.panel}

      {/* 계약(매칭) 목록은 라이더/차량 패널의 컬럼에 이미 행별로 표시되어
          있어 별도 ContractsPanel 은 제거. 종료 동작은 라이더 상세
          다이얼로그의 view 모드 "계약 종료" 버튼으로 옮김. */}
      {/* 인라인 매칭 등록 폼. 라이더 / 차량은 위 패널 행에서 드래그하거나
          슬롯 안 검색으로 채울 수 있고, 양식 / 시작일만 직접 입력.
          statusParam 으로 server action 의 silent redirect 결과를 받아
          폼 위에 안내 띄움 (중복 매칭 거부 등). */}
      <ContractMatchingForm
        riderOptions={riderOptions}
        vehicleOptions={vehicleOptions}
        templateOptions={templateOptions}
        statusParam={statusParam ?? null}
      />
      </OverviewClientShell>
      </div>
    </NotificationProvider>
  );
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

// Loader for the stations tab; riders + vehicles are handled inline
// because the parent component already fetched their data for cross-
// tab lookups.
async function loadOtherTabContent(
  tab: Extract<TabKey, "stations">
): Promise<{ panel: ReactNode; notice: string | undefined }> {
  switch (tab) {
    case "stations": {
      const data = await loadStationList();
      return { panel: <StationsPanel data={data} />, notice: data.notice };
    }
  }
}
