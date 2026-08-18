"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MapShell } from "@/components/dashboard/MapShell";
import { VehicleDetailDialog, type VehicleDetailRow } from "@/components/management/VehicleDetailDialog";
import { BottomMapPanel } from "@/components/overview/BottomMapPanel";
import { DeliveryFocusPanel } from "@/components/overview/DeliveryFocusPanel";
import { useFocusDispatchOrders } from "@/components/overview/use-focus-dispatch-orders";
import { TipsPanel } from "@/components/overview/TipsPanel";
import { useFleetSimulation } from "@/components/overview/FleetSimulationContext";
import { usePollingBikePins } from "@/components/overview/use-polling-bike-pins";
import { useRealVehiclePlayback } from "@/components/overview/use-real-vehicle-playback";
import { useSimulatedBikePins } from "@/components/overview/use-simulated-bike-pins";
import { useTrailWaypoints } from "@/components/overview/use-trail-waypoints";
import { useVehicleFilter } from "@/components/overview/VehicleFilterContext";
import { isCleaningPurpose } from "@/lib/services/fleet-simulation";
import { PurposeFilterTabs, type PurposeFilter } from "@/components/overview/PurposeFilterTabs";
import { OverviewMapSearch, type OverviewMapSearchMatch } from "@/components/overview/OverviewMapSearch";
import { NotificationBell } from "@/components/layout/NotificationBell";
import type { InsuranceOption } from "@/types/insurance-option";
import type {
  FrontendDashboardBikePin,
  FrontendRider,
  FrontendTipPin,
  FrontendVehicle,
  ServiceOpsInsuranceItem,
  ServiceOpsRiderEducationType,
  ServiceOpsRiderInsurance
} from "@/lib/services/service-ops-api";
import type { RiderActiveContractSummary } from "@/lib/services/rider-matching-snapshot-data";
import type { VehicleDataResult } from "@/lib/services/vehicle-data";
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
  tipPins: ReadonlyArray<FrontendTipPin>;
  // for filter computation
  vehicles: ReadonlyArray<FrontendVehicle>;
  riders: ReadonlyArray<FrontendRider>;
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
  riderActiveInsuranceByRiderId?: Map<string, ServiceOpsRiderInsurance>;
}

export function FullscreenMapHost(props: FullscreenMapHostProps) {
  const {
    bikePins,
    tipPins,
    vehicles,
    bikeActiveRiderById,
    riderInfoById,
    educationTypeByRiderId,
    riderActiveContractById,
    insuranceOptions,
    riderInsuranceById,
    vehicleData,
    riderActiveInsuranceByRiderId
  } = props;

  const { selectedBikeId, setSelectedBikeId } = useVehicleFilter();

  // 팁 선택 상태 — 지도 보라 마커 클릭과 하단 팁 패널 행 클릭이 공유한다.
  // 마커 클릭 → setSelectedTipId → TipsPanel 행 하이라이트. 행 클릭 → 동일.
  const [selectedTipId, setSelectedTipId] = useState<string | null>(null);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);

  const [purposeFilter, setPurposeFilter] = useState<PurposeFilter>("ALL");
  const [searchOverride, setSearchOverride] = useState<{ lat: number; lng: number } | null>(null);
  // 포커스 진입(차량 선택) 시 1회 fit 을 발화시키는 trigger. selectedBikeId 가
  // 바뀔 때마다 증가시켜 entry point(마커 클릭 / 검색 / 하단 차량표) 와 무관하게
  // 새 선택을 감지한다. setState 는 effect 본문이 아니라 rAF 콜백 안에서 호출해
  // react-hooks/set-state-in-effect 를 피한다(아래 searchOverride 리셋 effect 와
  // 동일 관용구).
  const [focusTrigger, setFocusTrigger] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedBikeId) return;
    const handle = window.requestAnimationFrame(() => {
      setFocusTrigger((t) => t + 1);
      // 어느 경로로 선택하든(마커·검색·하단 차량표) 포커스 진입 시 하단 패널 접기.
      setBottomPanelOpen(false);
    });
    return () => window.cancelAnimationFrame(handle);
  }, [selectedBikeId]);

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

  const purposeFilteredVehicles = useMemo(
    () =>
      purposeFilter === "ALL"
        ? vehicles
        : vehicles.filter((v) => (v.purpose ?? "DELIVERY") === purposeFilter),
    [vehicles, purposeFilter]
  );

  const visibleVehicles = purposeFilteredVehicles;

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

  // 포커스 모드에선 자동 따라가기를 끈다 — 진입 시 focusBounds 로 1회 fit 한 뒤
  // 운영자가 자유롭게 팬/줌한다. 그래서 targetLocation 은 검색/배송행 클릭의
  // one-shot 팬(searchOverride) 만 담당하고, 선택 차량을 매 tick 재중심하던
  // 옛 분기는 제거했다.
  const targetLocation = useMemo(() => {
    if (searchOverride) {
      return { lat: searchOverride.lat, lng: searchOverride.lng };
    }
    return null;
  }, [searchOverride]);

  // 검색 override 는 그 클릭 한 번에만 의미가 있다. selectedBikeId 가 다음에
  // 다른 차량으로 바뀌면 follow 흐름에 양보. override 가 없으면 no-op short-
  // circuit (마운트 시점 / station 클릭 직후의 불필요한 rAF 방지).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!searchOverride) return;
    const handle = window.requestAnimationFrame(() => setSearchOverride(null));
    return () => window.cancelAnimationFrame(handle);
  }, [selectedBikeId, searchOverride]);

  // 지도에서의 차량 선택 진입점(마커 클릭 / 검색). 포커스 진입 시 하단 패널을
  // 접어 지도 가운데 공간을 확보한다(이 side-effect 는 이벤트에서 처리해
  // react-hooks/set-state-in-effect 를 피한다). fit 트리거는 selectedBikeId
  // 변경을 render 단계에서 감지하는 focusTriggerRef 가 담당하므로 여기서
  // 별도로 올리지 않는다(하단 차량표 등 다른 entry point 도 동일하게 fit 됨).
  const handleSelectBike = useCallback(
    (bikeId: string) => {
      setSelectedBikeId(bikeId);
      setBottomPanelOpen(false);
    },
    [setSelectedBikeId]
  );

  const handleSearchSelect = (match: OverviewMapSearchMatch) => {
    setSearchOverride({ lat: match.latitude, lng: match.longitude });
    if (match.kind === "bike") {
      handleSelectBike(match.bikeId);
    }
  };

  // ── 포커스 모드 ──
  // selectedBikeId != null 이면 포커스 모드: 지도에 선택 차량 1대 + 그 차량의
  // 배송지 마커, 왼쪽 배송 리스트, 하단 패널 접힘, 자동 따라가기 off.
  const focusMode = selectedBikeId != null;

  const { active: activeOrders, completed: completedOrders, loading: ordersLoading } =
    useFocusDispatchOrders(selectedBikeId);

  const selectedPin = selectedBikeId ? bikePinById.get(selectedBikeId) ?? null : null;
  const selectedVehicle = selectedBikeId ? vehicleById.get(selectedBikeId) ?? null : null;
  const isSequential = isCleaningPurpose(selectedVehicle?.purpose);

  // 배송지 핀 — 실차량은 active+completed 주문의 좌표, 좌표 없음/0,0 은 스킵.
  // 시뮬 차량(배차가 client-synthesized 라 listDispatchOrders 에 없음)은
  // 선택 pin 의 currentDispatch 좌표가 있으면 그 1건만 active 배송지로 합성한다.
  const dispatchPins = useMemo(() => {
    if (!focusMode) return [];
    const pins: Array<{
      id: string;
      lat: number;
      lng: number;
      label: string;
      address?: string | null;
      sequence?: number | null;
      completed: boolean;
    }> = [];
    for (const o of activeOrders) {
      if (!o.latitude && !o.longitude) continue;
      pins.push({
        id: o.id,
        lat: o.latitude,
        lng: o.longitude,
        label: o.customerName,
        address: o.address,
        sequence: o.sequence,
        completed: false
      });
    }
    for (const o of completedOrders) {
      if (!o.latitude && !o.longitude) continue;
      pins.push({
        id: o.id,
        lat: o.latitude,
        lng: o.longitude,
        label: o.customerName,
        address: o.address,
        sequence: o.sequence,
        completed: true
      });
    }
    // 시뮬 fallback: 실 주문이 하나도 없고 선택 pin 의 현재 배송지 좌표가 있으면
    // 그 1건만 active 배송지로 표시(시뮬 차량은 완료 이력 소스 없음).
    if (
      pins.length === 0 &&
      selectedPin &&
      selectedPin.currentDispatchLatitude != null &&
      selectedPin.currentDispatchLongitude != null &&
      (selectedPin.currentDispatchLatitude !== 0 || selectedPin.currentDispatchLongitude !== 0)
    ) {
      pins.push({
        id: `sim-${selectedPin.bikeId}`,
        lat: selectedPin.currentDispatchLatitude,
        lng: selectedPin.currentDispatchLongitude,
        label: selectedPin.currentDispatchCustomerName ?? "배송지",
        address: selectedPin.currentDispatchAddress,
        sequence: null,
        completed: false
      });
    }
    return pins;
  }, [focusMode, activeOrders, completedOrders, selectedPin]);

  const focusBounds = useMemo(() => {
    if (!focusMode || !selectedPin) return null;
    const points: Array<{ lat: number; lng: number }> = [
      { lat: selectedPin.latitude, lng: selectedPin.longitude }
    ];
    for (const p of dispatchPins) points.push({ lat: p.lat, lng: p.lng });
    // trigger: 선택 변경(focusTrigger)마다 1회 fit. 추가로, 배송지가 비어서
    // 차량만 잡고 fit 한 뒤 배송 주문이 늦게 로드돼 처음 비어있지 않게 되는
    // 순간 한 번 더 fit 해 "차량 + 모든 배송지" 를 담는다(empty→non-empty 1회만
    // 값이 바뀌므로 폴링 중 재중심은 없다).
    const trigger = focusTrigger * 2 + (points.length > 1 ? 1 : 0);
    return { points, trigger };
  }, [focusMode, selectedPin, dispatchPins, focusTrigger]);

  // 포커스 시 지도에 넘기는 차량 핀: 선택 1대만(station/tip 은 그대로). 해제 시
  // 전체 visibleBikePins 복원.
  const mapBikePins = useMemo(
    () =>
      focusMode
        ? overlaidBikePins.filter((p) => p.bikeId === selectedBikeId)
        : [...visibleBikePins],
    [focusMode, overlaidBikePins, selectedBikeId, visibleBikePins]
  );

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
          onSelect={handleSearchSelect}
        />
        <PurposeFilterTabs value={purposeFilter} onChange={setPurposeFilter} />
        <NotificationBell />
      </header>
      <main className="fullscreen-map-canvas">
        <MapShell
          bikePins={mapBikePins}
          tipPins={[...tipPins]}
          targetLocation={targetLocation}
          selectedBikeId={selectedBikeId}
          onBikeSelect={handleSelectBike}
          onTipSelect={setSelectedTipId}
          fitBoundsPadding={FULLSCREEN_FIT_BOUNDS_PADDING}
          trailWaypoints={trailWaypoints}
          dispatchPins={dispatchPins}
          focusBounds={focusBounds}
        />
        {focusMode && selectedBikeId ? (
          <DeliveryFocusPanel
            active={activeOrders}
            completed={completedOrders}
            loading={ordersLoading}
            isSequential={isSequential}
            onClose={() => setSelectedBikeId(null)}
            onSelectDestination={(p) => setSearchOverride(p)}
          />
        ) : null}
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
          tipContent={<TipsPanel selectedTipId={selectedTipId} onTipSelect={setSelectedTipId} />}
        />
      </main>
    </div>
  );
}
