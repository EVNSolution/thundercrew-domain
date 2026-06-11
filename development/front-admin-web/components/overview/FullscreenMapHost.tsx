"use client";

import { useEffect, useMemo, useState } from "react";

import { MapShell } from "@/components/dashboard/MapShell";
import { VehicleDetailDialog, type VehicleDetailRow } from "@/components/management/VehicleDetailDialog";
import { BottomMapPanel } from "@/components/overview/BottomMapPanel";
import { TipsPanel } from "@/components/overview/TipsPanel";
import type { ContractMatchingOption } from "@/components/management/ContractMatchingForm";
import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
import { useSimulatedBikePins } from "@/components/overview/use-simulated-bike-pins";
import { useTrailWaypoints } from "@/components/overview/use-trail-waypoints";
import { useVehicleFilter } from "@/components/overview/VehicleFilterContext";
import {
  applyRiderFilters,
  applyStationFilters,
  applyVehicleFilters,
  DEFAULT_RIDER_FILTERS,
  DEFAULT_STATION_FILTERS,
  DEFAULT_VEHICLE_FILTERS,
  type RiderFilterState,
  type StationFilterState,
  type VehicleFilterState
} from "@/components/overview/filter-compute";
import { RiderFilterControls } from "@/components/overview/RiderFilterControls";
import { StationFilterControls } from "@/components/overview/StationFilterControls";
import { VehicleFilterControls } from "@/components/overview/VehicleFilterControls";
import { ServiceTypeFilterTabs, type ServiceTypeFilter } from "@/components/overview/ServiceTypeFilterTabs";
import { OverviewMapSearch, type OverviewMapSearchMatch } from "@/components/overview/OverviewMapSearch";
import { NotificationBell } from "@/components/layout/NotificationBell";
import type { InsuranceOption } from "@/components/management/RidersPanel";
import type {
  FrontendDashboardBikePin,
  FrontendDashboardStationPin,
  FrontendRider,
  FrontendTipPin,
  FrontendVehicle,
  ServiceOpsInsuranceItem,
  ServiceOpsRiderEducationType,
  ServiceOpsRiderInsurance
} from "@/lib/services/service-ops-api";
import type { RiderActiveContractSummary } from "@/lib/services/rider-matching-snapshot-data";
import type { StationDataResult } from "@/lib/services/station-data";
import type { VehicleDataResult } from "@/lib/services/vehicle-data";
import type { BatteryStation } from "@/types/domain";
import type { VehicleMaintenanceSummary } from "@/components/management/vehicle-maintenance-derive";

// 모듈 레벨 상수 — `MapShell` 의 `fitBoundsPadding` deps 가 매 렌더마다 새
// 객체로 트리거되지 않도록 안정된 reference 를 유지한다. 값 조정 시 여기
// 한 곳만 바꾸면 됨. top 은 헤더(56px) + filter bar (≤ 100px wrap 포함)
// + 안전 margin 합산. bottom 은 하단 패널 탭 바(≈ 44px) 위로 마커를 띄우기
// 위한 여유.
const FULLSCREEN_FIT_BOUNDS_PADDING = { top: 180, right: 48, bottom: 96, left: 48 };

/**
 * 전체화면 지도 호스트. 예전엔 토글 오버레이였지만 이제 운영 콘솔의 메인
 * 레이아웃으로 항상 마운트된다 (open/close gating 제거). 지도 캔버스가 base
 * layer 이고, 그 위로 floating 헤더 / 필터 바 / 하단 BottomMapPanel 이 떠 있다.
 *
 * 필터 state 는 이 컴포넌트 내부 useState 3 슬라이스 — 하단 패널 표들과
 * 공유하지 않는다.
 *
 * 마커 visibility 는 차량 필터 통과 set ∩ (라이더 필터를 통과한 라이더의
 * 배정 차량 set) 으로 계산. 라이더 필터가 defaults 면 차량 set 그대로 통과.
 */
export interface FullscreenMapHostProps {
  // map pins
  bikePins: ReadonlyArray<FrontendDashboardBikePin>;
  stationPins: ReadonlyArray<FrontendDashboardStationPin>;
  tipPins: ReadonlyArray<FrontendTipPin>;
  // for filter computation
  vehicles: ReadonlyArray<FrontendVehicle>;
  riders: ReadonlyArray<FrontendRider>;
  stations: ReadonlyArray<BatteryStation>;
  bikeActiveRiderById?: Map<string, string>;
  riderInfoById?: Map<string, { name: string; phone: string }>;
  deviceUidByBikeId?: Map<string, string>;
  maintenanceSummaryByBike?: Map<string, VehicleMaintenanceSummary>;
  educationTypeByRiderId?: Map<string, ServiceOpsRiderEducationType>;
  riderActiveBikeId?: Map<string, string>;
  riderActiveBikePlate?: Map<string, string>;
  riderActiveContractById?: Map<string, RiderActiveContractSummary>;
  insuredRiderIds?: ReadonlySet<string>;
  ignitionStatusByBikeId?: Map<string, string>;
  /** riderId → 활성 rider_insurance 전체 목록. VehicleDetailDialog 보험 편집에 사용. */
  riderAllInsurancesByRiderId?: Map<string, ServiceOpsRiderInsurance[]>;
  /** insurance_item id → item. PRIMARY/ADDON 분류 lookup. */
  insuranceItemById?: Map<string, ServiceOpsInsuranceItem>;
  /** 보험 상품 선택지. VehicleDetailDialog + 하단 차량 패널에 사용. */
  insuranceOptions?: ReadonlyArray<InsuranceOption>;
  /** bikeId → 시동 방지 토글 현재 상태. 하단 차량 패널의 인라인 토글 초기값. */
  ignitionBlockedByBikeId?: Map<string, boolean>;
  // bottom panel
  /** VehiclesPanel 이 그대로 받는 차량 데이터 결과 (notice / source 포함). */
  vehicleData: VehicleDataResult;
  stationData: StationDataResult;
  riderActiveInsuranceByRiderId?: Map<string, ServiceOpsRiderInsurance>;
  riderOptions: ContractMatchingOption[];
  vehicleOptions: ContractMatchingOption[];
  templateOptions: ContractMatchingOption[];
  statusParam: string | null;
}

export function FullscreenMapHost(props: FullscreenMapHostProps) {
  const {
    bikePins,
    stationPins,
    tipPins,
    vehicles,
    riders,
    stations,
    bikeActiveRiderById,
    riderInfoById,
    deviceUidByBikeId,
    maintenanceSummaryByBike,
    educationTypeByRiderId,
    riderActiveBikeId,
    riderActiveBikePlate,
    riderActiveContractById,
    insuredRiderIds,
    ignitionStatusByBikeId,
    riderAllInsurancesByRiderId,
    insuranceItemById,
    insuranceOptions,
    ignitionBlockedByBikeId,
    vehicleData,
    stationData,
    riderActiveInsuranceByRiderId,
    riderOptions,
    vehicleOptions,
    templateOptions,
    statusParam
  } = props;

  const { selectedBikeId, setSelectedBikeId } = useVehicleFilter();

  // 팁 선택 상태 — 지도 보라 마커 클릭과 하단 팁 패널 행 클릭이 공유한다.
  // 마커 클릭 → setSelectedTipId → TipsPanel 행 하이라이트. 행 클릭 → 동일.
  const [selectedTipId, setSelectedTipId] = useState<string | null>(null);

  const [vehicleFilters, setVehicleFilters] = useState<VehicleFilterState>(DEFAULT_VEHICLE_FILTERS);
  const [riderFilters, setRiderFilters] = useState<RiderFilterState>(DEFAULT_RIDER_FILTERS);
  const [stationFilters, setStationFilters] = useState<StationFilterState>(DEFAULT_STATION_FILTERS);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceTypeFilter>("ALL");
  const [searchOverride, setSearchOverride] = useState<{ lat: number; lng: number } | null>(null);
  // 필터 바 펼침/접힘. 기본 접힘 — 지도가 최대한 넓게 보이도록.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { seedBikePins } = useFleetSimulation();

  const overlaidBikePins = useSimulatedBikePins(bikePins);
  const trailWaypoints = useTrailWaypoints(selectedBikeId);

  useEffect(() => {
    seedBikePins(bikePins);
  }, [bikePins, seedBikePins]);

  const bikePinById = useMemo(() => {
    const map = new Map<string, FrontendDashboardBikePin>();
    for (const pin of overlaidBikePins) map.set(pin.bikeId, pin);
    return map;
  }, [overlaidBikePins]);

  const vehicleById = useMemo(() => {
    const map = new Map<string, FrontendVehicle>();
    for (const vehicle of vehicles) {
      const key = vehicle.id ?? vehicle.slug;
      if (key) map.set(key, vehicle);
    }
    return map;
  }, [vehicles]);

  const serviceTypeFilteredVehicles = useMemo(
    () =>
      serviceTypeFilter === "ALL"
        ? vehicles
        : vehicles.filter((v) => (v.serviceType ?? "DELIVERY") === serviceTypeFilter),
    [vehicles, serviceTypeFilter]
  );

  const visibleVehicles = useMemo(
    () =>
      applyVehicleFilters({
        vehicles: serviceTypeFilteredVehicles,
        filters: vehicleFilters,
        bikePinById,
        deviceUidByBikeId,
        maintenanceSummaryByBike
      }),
    [serviceTypeFilteredVehicles, vehicleFilters, bikePinById, deviceUidByBikeId, maintenanceSummaryByBike]
  );

  const visibleRiders = useMemo(
    () =>
      applyRiderFilters({
        riders,
        filters: riderFilters,
        educationTypeByRiderId,
        riderActiveBikeId,
        riderActiveBikePlate,
        riderActiveContractById,
        insuredRiderIds,
        ignitionStatusByBikeId
      }),
    [
      riders,
      riderFilters,
      educationTypeByRiderId,
      riderActiveBikeId,
      riderActiveBikePlate,
      riderActiveContractById,
      insuredRiderIds,
      ignitionStatusByBikeId
    ]
  );

  const visibleStations = useMemo(
    () => applyStationFilters({ stations, filters: stationFilters }),
    [stations, stationFilters]
  );

  // 라이더 필터가 defaults 면 라이더 매핑 거치지 않고 차량 후보 그대로 통과
  // (의도된 비차단 동작). 필드 비교를 명시적으로 — onChange 마다 spread 라
  // reference equality 한 번에 의존할 수 없으므로.
  const riderFilterIsDefault =
    riderFilters.query.trim() === "" &&
    riderFilters.education === "ALL" &&
    riderFilters.assignment === "ALL" &&
    riderFilters.contractCategory === "ALL" &&
    riderFilters.insurance === "ALL" &&
    riderFilters.ignition === "ALL";

  const visibleBikePins = useMemo(() => {
    const allowedBikeIds = new Set<string>();
    if (riderFilterIsDefault) {
      for (const vehicle of visibleVehicles) {
        const key = vehicle.id ?? vehicle.slug;
        if (key) allowedBikeIds.add(key);
      }
    } else {
      const ridersWithBikes = new Set<string>();
      for (const rider of visibleRiders) {
        const riderKey = rider.id ?? rider.slug;
        const bikeId = riderActiveBikeId?.get(riderKey);
        if (bikeId) ridersWithBikes.add(bikeId);
      }
      for (const vehicle of visibleVehicles) {
        const key = vehicle.id ?? vehicle.slug;
        if (key && ridersWithBikes.has(key)) allowedBikeIds.add(key);
      }
    }
    return overlaidBikePins.filter((pin) => allowedBikeIds.has(pin.bikeId));
  }, [visibleVehicles, visibleRiders, riderFilterIsDefault, riderActiveBikeId, overlaidBikePins]);

  const visibleStationPins = useMemo(() => {
    const allowed = new Set<string>();
    for (const station of visibleStations) {
      if (station.id) allowed.add(station.id);
    }
    return stationPins.filter((pin) => allowed.has(pin.stationId));
  }, [visibleStations, stationPins]);

  const targetLocation = useMemo(() => {
    if (searchOverride) {
      return { lat: searchOverride.lat, lng: searchOverride.lng };
    }
    if (!selectedBikeId) return null;
    const pin = bikePinById.get(selectedBikeId);
    if (!pin) return null;
    return { lat: pin.latitude, lng: pin.longitude };
  }, [searchOverride, selectedBikeId, bikePinById]);

  // 검색 override 는 그 클릭 한 번에만 의미가 있다. selectedBikeId 가 다음에
  // 다른 차량으로 바뀌면 follow 흐름에 양보. override 가 없으면 no-op short-
  // circuit (마운트 시점 / station 클릭 직후의 불필요한 rAF 방지).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!searchOverride) return;
    const handle = window.requestAnimationFrame(() => setSearchOverride(null));
    return () => window.cancelAnimationFrame(handle);
  }, [selectedBikeId, searchOverride]);

  const handleSearchSelect = (match: OverviewMapSearchMatch) => {
    setSearchOverride({ lat: match.latitude, lng: match.longitude });
    if (match.kind === "bike") {
      setSelectedBikeId(match.bikeId);
    }
  };

  const detailRow: VehicleDetailRow | null = useMemo(() => {
    if (!selectedBikeId) return null;
    const vehicle = vehicleById.get(selectedBikeId);
    if (!vehicle) return null;
    const riderId = bikeActiveRiderById?.get(selectedBikeId) ?? null;
    const riderInfo = riderId ? riderInfoById?.get(riderId) ?? null : null;
    const riderInsurances = riderId ? (riderAllInsurancesByRiderId?.get(riderId) ?? []) : [];
    const primaryIns = riderInsurances.find((ins) => {
      const item = insuranceItemById?.get(ins.insuranceItemId);
      return !item?.category || item.category === "PRIMARY";
    }) ?? (insuranceItemById ? null : riderInsurances[0] ?? null);
    const addonInsurances = insuranceItemById
      ? riderInsurances.filter((ins) => insuranceItemById.get(ins.insuranceItemId)?.category === "ADDON")
      : [];
    return {
      vehicle,
      riderName: riderInfo?.name ?? null,
      riderPhone: riderInfo?.phone ?? null,
      riderId,
      currentPrimaryInsuranceId: primaryIns?.id ?? null,
      currentPrimaryInsuranceItemId: primaryIns?.insuranceItemId ?? null,
      addonInsurances: addonInsurances.map((ins) => ({ id: ins.id, itemId: ins.insuranceItemId }))
    };
  }, [selectedBikeId, vehicleById, bikeActiveRiderById, riderInfoById, riderAllInsurancesByRiderId, insuranceItemById]);

  return (
    <div className="fullscreen-map-overlay" role="main" aria-label="운영 지도">
      <header className="fullscreen-map-header">
        {/* 필터 바를 다시 노출하는 헤더 버튼. 필터가 열려 있을 때도 같은 버튼이
            존재하며 클릭으로 닫을 수 있다. */}
        <button
          type="button"
          className={filtersOpen ? "fullscreen-map-filter-reopen fullscreen-map-filter-reopen--active" : "fullscreen-map-filter-reopen"}
          onClick={() => setFiltersOpen((v) => !v)}
          aria-pressed={filtersOpen}
          title={filtersOpen ? "필터 숨기기" : "필터 보기"}
        >
          필터
        </button>
        <OverviewMapSearch
          bikePins={overlaidBikePins}
          stationPins={stationPins}
          onSelect={handleSearchSelect}
        />
        <ServiceTypeFilterTabs value={serviceTypeFilter} onChange={setServiceTypeFilter} />
        <span className="fullscreen-map-counts">
          {visibleBikePins.length}대 차량 · {visibleStationPins.length}개 충전소
        </span>
        <NotificationBell />
      </header>
      {filtersOpen ? (
        <div className="fullscreen-map-filter-bar">
          <VehicleFilterControls
            filters={vehicleFilters}
            onChange={setVehicleFilters}
            layout="horizontal"
            hideSearch
            count={{ visible: visibleVehicles.length, total: serviceTypeFilteredVehicles.length }}
          />
          <RiderFilterControls
            filters={riderFilters}
            onChange={setRiderFilters}
            layout="horizontal"
            hideSearch
          />
          <StationFilterControls
            filters={stationFilters}
            onChange={setStationFilters}
            layout="horizontal"
            hideSearch
          />
          <button
            type="button"
            className="fullscreen-map-filter-bar-close"
            onClick={() => setFiltersOpen(false)}
            title="필터 숨기기"
            aria-label="필터 바 닫기"
          >
            ✕
          </button>
        </div>
      ) : null}
      <main className="fullscreen-map-canvas">
        <MapShell
          bikePins={[...visibleBikePins]}
          stationPins={[...visibleStationPins]}
          tipPins={[...tipPins]}
          targetLocation={targetLocation}
          onBikeSelect={setSelectedBikeId}
          onTipSelect={setSelectedTipId}
          fitBoundsPadding={FULLSCREEN_FIT_BOUNDS_PADDING}
          trailWaypoints={trailWaypoints}
        />
        <VehicleDetailDialog
          key={detailRow ? (detailRow.vehicle.id ?? detailRow.vehicle.slug) : "none"}
          row={detailRow}
          insuranceOptions={insuranceOptions ?? []}
          onClose={() => setSelectedBikeId(null)}
        />
        <BottomMapPanel
          vehicleData={vehicleData}
          visibleVehicles={visibleVehicles}
          bikeActiveRiderById={bikeActiveRiderById ?? new Map()}
          riderInfoById={riderInfoById ?? new Map()}
          bikePins={bikePins}
          deviceUidByBikeId={deviceUidByBikeId ?? new Map()}
          educationTypeByRiderId={educationTypeByRiderId ?? new Map()}
          riderActiveContractById={riderActiveContractById ?? new Map()}
          riderActiveInsuranceByRiderId={riderActiveInsuranceByRiderId ?? new Map()}
          insuranceOptions={insuranceOptions ?? []}
          ignitionBlockedByBikeId={ignitionBlockedByBikeId ?? new Map()}
          statusParam={statusParam}
          stationData={stationData}
          riderOptions={riderOptions}
          vehicleOptions={vehicleOptions}
          templateOptions={templateOptions}
          tipContent={<TipsPanel selectedTipId={selectedTipId} onTipSelect={setSelectedTipId} />}
        />
      </main>
    </div>
  );
}
