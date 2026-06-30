"use client";

import { useEffect, useMemo, useState } from "react";

import { MapShell } from "@/components/dashboard/MapShell";
import { VehicleDetailDialog, type VehicleDetailRow } from "@/components/management/VehicleDetailDialog";
import { BottomMapPanel } from "@/components/overview/BottomMapPanel";
import { TipsPanel } from "@/components/overview/TipsPanel";
import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
import { usePollingBikePins } from "@/components/overview/use-polling-bike-pins";
import { useRealVehiclePlayback } from "@/components/overview/use-real-vehicle-playback";
import { useSimulatedBikePins } from "@/components/overview/use-simulated-bike-pins";
import { useTrailWaypoints } from "@/components/overview/use-trail-waypoints";
import { useVehicleFilter } from "@/components/overview/VehicleFilterContext";
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
  /** riderId → 라이더 보험 자유 텍스트(기본/추가). 차량 상세 + 하단 차량 패널 보험 표시. */
  riderInsuranceById?: Map<string, { primaryInsurance: string | null; addonInsurance: string | null }>;
  // bottom panel
  /** VehiclesPanel 이 그대로 받는 차량 데이터 결과 (notice / source 포함). */
  vehicleData: VehicleDataResult;
  stationData: StationDataResult;
  riderActiveInsuranceByRiderId?: Map<string, ServiceOpsRiderInsurance>;
}

export function FullscreenMapHost(props: FullscreenMapHostProps) {
  const {
    bikePins,
    stationPins,
    tipPins,
    vehicles,
    bikeActiveRiderById,
    riderInfoById,
    educationTypeByRiderId,
    riderActiveContractById,
    insuranceOptions,
    riderInsuranceById,
    vehicleData,
    stationData,
    riderActiveInsuranceByRiderId
  } = props;

  const { selectedBikeId, setSelectedBikeId } = useVehicleFilter();

  // 팁 선택 상태 — 지도 보라 마커 클릭과 하단 팁 패널 행 클릭이 공유한다.
  // 마커 클릭 → setSelectedTipId → TipsPanel 행 하이라이트. 행 클릭 → 동일.
  const [selectedTipId, setSelectedTipId] = useState<string | null>(null);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);

  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceTypeFilter>("ALL");
  const [searchOverride, setSearchOverride] = useState<{ lat: number; lng: number } | null>(null);

  const { seedBikePins } = useFleetSimulation();

  const polledPins = usePollingBikePins(bikePins);
  const playedPins = useRealVehiclePlayback(polledPins);
  const overlaidBikePins = useSimulatedBikePins(playedPins);
  const trailWaypoints = useTrailWaypoints(selectedBikeId, playedPins);

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
        : vehicles.filter((v) => (v.serviceType ?? "SINGLE") === serviceTypeFilter),
    [vehicles, serviceTypeFilter]
  );

  const visibleVehicles = serviceTypeFilteredVehicles;

  const visibleVehicleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const v of visibleVehicles) {
      const key = v.id ?? v.slug;
      if (key) ids.add(key);
    }
    return ids;
  }, [visibleVehicles]);

  const visibleBikePins = useMemo(
    () => overlaidBikePins.filter((pin) => visibleVehicleIds.has(pin.bikeId)),
    [overlaidBikePins, visibleVehicleIds]
  );

  const visibleStationPins = useMemo(() => [...stationPins], [stationPins]);

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
    const insurance = riderId ? riderInsuranceById?.get(riderId) ?? null : null;
    return {
      vehicle,
      riderName: riderInfo?.name ?? null,
      riderPhone: riderInfo?.phone ?? null,
      riderId,
      primaryInsurance: insurance?.primaryInsurance ?? null,
      addonInsurance: insurance?.addonInsurance ?? null
    };
  }, [selectedBikeId, vehicleById, bikeActiveRiderById, riderInfoById, riderInsuranceById]);

  return (
    <div className="fullscreen-map-overlay" role="main" aria-label="운영 지도">
      <header className="fullscreen-map-header">
        <OverviewMapSearch
          bikePins={overlaidBikePins}
          stationPins={stationPins}
          onSelect={handleSearchSelect}
        />
        <ServiceTypeFilterTabs value={serviceTypeFilter} onChange={setServiceTypeFilter} />
        <NotificationBell />
      </header>
      <main className="fullscreen-map-canvas">
        <MapShell
          bikePins={[...visibleBikePins]}
          stationPins={[...visibleStationPins]}
          tipPins={[...tipPins]}
          targetLocation={targetLocation}
          selectedBikeId={selectedBikeId}
          onBikeSelect={setSelectedBikeId}
          onTipSelect={setSelectedTipId}
          fitBoundsPadding={FULLSCREEN_FIT_BOUNDS_PADDING}
          trailWaypoints={trailWaypoints}
        />
        <VehicleDetailDialog
          key={detailRow ? (detailRow.vehicle.id ?? detailRow.vehicle.slug) : "none"}
          row={detailRow}
          onClose={() => setSelectedBikeId(null)}
          bottomPanelOpen={bottomPanelOpen}
        />
        <BottomMapPanel
          open={bottomPanelOpen}
          onOpenChange={setBottomPanelOpen}
          vehicleData={vehicleData}
          visibleVehicles={visibleVehicles}
          bikeActiveRiderById={bikeActiveRiderById ?? new Map()}
          riderInfoById={riderInfoById ?? new Map()}
          educationTypeByRiderId={educationTypeByRiderId ?? new Map()}
          riderActiveContractById={riderActiveContractById ?? new Map()}
          riderActiveInsuranceByRiderId={riderActiveInsuranceByRiderId ?? new Map()}
          riderInsuranceById={riderInsuranceById ?? new Map()}
          insuranceOptions={insuranceOptions ?? []}
          stationData={stationData}
          tipContent={<TipsPanel selectedTipId={selectedTipId} onTipSelect={setSelectedTipId} />}
        />
      </main>
    </div>
  );
}
