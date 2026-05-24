"use client";

import { useEffect, useMemo, useState } from "react";

import { MapShell } from "@/components/dashboard/MapShell";
import { VehicleDetailDialog, type VehicleDetailRow } from "@/components/management/VehicleDetailDialog";
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
import { OverviewMapSearch, type OverviewMapSearchMatch } from "@/components/overview/OverviewMapSearch";
import type {
  FrontendDashboardBikePin,
  FrontendDashboardStationPin,
  FrontendRider,
  FrontendVehicle,
  ServiceOpsRiderEducationType
} from "@/lib/services/service-ops-api";
import type { RiderActiveContractSummary } from "@/lib/services/rider-matching-snapshot-data";
import type { BatteryStation } from "@/types/domain";
import type { VehicleMaintenanceSummary } from "@/components/management/vehicle-maintenance-derive";

// 모듈 레벨 상수 — `MapShell` 의 `fitBoundsPadding` deps 가 매 렌더마다 새
// 객체로 트리거되지 않도록 안정된 reference 를 유지한다. 값 조정 시 여기
// 한 곳만 바꾸면 됨. top 은 헤더(56px) + filter bar (≤ 100px wrap 포함)
// + 안전 margin 합산.
const FULLSCREEN_FIT_BOUNDS_PADDING = { top: 180, right: 48, bottom: 48, left: 48 };

/**
 * 전체화면 지도 모드. `OverviewMapBanner` 의 [⛶ 전체화면] 버튼이
 * `setFullscreenMapOpen(true)` 를 호출하면 이 컴포넌트가 viewport 전체를
 * 덮는 fixed-position 오버레이를 마운트한다.
 *
 * 필터 state 는 이 컴포넌트 내부 useState 3 슬라이스 — 표 패널들과 공유하지
 * 않고, 닫으면 사라진다 (재진입 시 defaults).
 *
 * 마커 visibility 는 차량 필터 통과 set ∩ (라이더 필터를 통과한 라이더의
 * 배정 차량 set) 으로 계산. 라이더 필터가 defaults 면 차량 set 그대로 통과.
 */
export interface FullscreenMapHostProps {
  bikePins: ReadonlyArray<FrontendDashboardBikePin>;
  stationPins: ReadonlyArray<FrontendDashboardStationPin>;
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
}

export function FullscreenMapHost(props: FullscreenMapHostProps) {
  const { fullscreenMapOpen, setFullscreenMapOpen, selectedBikeId, setSelectedBikeId } = useVehicleFilter();

  // ESC 으로 닫기. open 상태일 때만 listener 부착.
  useEffect(() => {
    if (!fullscreenMapOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreenMapOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreenMapOpen, setFullscreenMapOpen]);

  if (!fullscreenMapOpen) return null;

  return (
    <FullscreenMapOverlay
      {...props}
      onClose={() => setFullscreenMapOpen(false)}
      selectedBikeId={selectedBikeId}
      setSelectedBikeId={setSelectedBikeId}
    />
  );
}

type OverlayProps = FullscreenMapHostProps & {
  onClose: () => void;
  selectedBikeId: string | null;
  setSelectedBikeId: (id: string | null) => void;
};

function FullscreenMapOverlay({
  bikePins,
  stationPins,
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
  onClose,
  selectedBikeId,
  setSelectedBikeId
}: OverlayProps) {
  const [vehicleFilters, setVehicleFilters] = useState<VehicleFilterState>(DEFAULT_VEHICLE_FILTERS);
  const [riderFilters, setRiderFilters] = useState<RiderFilterState>(DEFAULT_RIDER_FILTERS);
  const [stationFilters, setStationFilters] = useState<StationFilterState>(DEFAULT_STATION_FILTERS);
  const [searchOverride, setSearchOverride] = useState<{ lat: number; lng: number } | null>(null);
  // 필터 바 펼침/접힘. 기본 펼침 — 운영자가 들어오자마자 필터들이 보이게.
  // 닫으면 11개 select 가 숨겨지고 토글 버튼만 작은 pill 로 남는다.
  const [filtersOpen, setFiltersOpen] = useState(true);

  const bikePinById = useMemo(() => {
    const map = new Map<string, FrontendDashboardBikePin>();
    for (const pin of bikePins) map.set(pin.bikeId, pin);
    return map;
  }, [bikePins]);

  const vehicleById = useMemo(() => {
    const map = new Map<string, FrontendVehicle>();
    for (const vehicle of vehicles) {
      const key = vehicle.id ?? vehicle.slug;
      if (key) map.set(key, vehicle);
    }
    return map;
  }, [vehicles]);

  const visibleVehicles = useMemo(
    () =>
      applyVehicleFilters({
        vehicles,
        filters: vehicleFilters,
        bikePinById,
        deviceUidByBikeId,
        maintenanceSummaryByBike
      }),
    [vehicles, vehicleFilters, bikePinById, deviceUidByBikeId, maintenanceSummaryByBike]
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
  // (의도된 비차단 동작). 필드 비교를 명시적으로 — reference equality 한 번에
  // 의존하지 않음 (onChange 마다 spread 라 ref 가 바뀌므로).
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
    return bikePins.filter((pin) => allowedBikeIds.has(pin.bikeId));
  }, [visibleVehicles, visibleRiders, riderFilterIsDefault, riderActiveBikeId, bikePins]);

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
    if (match.kind === "bike" || match.kind === "rider") {
      setSelectedBikeId(match.bikeId);
    }
  };

  const detailRow: VehicleDetailRow | null = useMemo(() => {
    if (!selectedBikeId) return null;
    const vehicle = vehicleById.get(selectedBikeId);
    if (!vehicle) return null;
    const riderId = bikeActiveRiderById?.get(selectedBikeId) ?? null;
    const riderInfo = riderId ? riderInfoById?.get(riderId) ?? null : null;
    return {
      vehicle,
      riderName: riderInfo?.name ?? null,
      riderPhone: riderInfo?.phone ?? null
    };
  }, [selectedBikeId, vehicleById, bikeActiveRiderById, riderInfoById]);

  return (
    <div className="fullscreen-map-overlay" role="dialog" aria-modal="true" aria-label="전체화면 지도">
      <header className="fullscreen-map-header">
        <button
          type="button"
          className="fullscreen-map-close"
          onClick={onClose}
          title="닫기 (ESC)"
          aria-label="전체화면 닫기"
        >
          ✕ 닫기
        </button>
        {/* 필터 바를 다시 노출하는 헤더 버튼. 필터가 열려 있을 때도 같은 버튼이
            존재하며 클릭으로 닫을 수 있다. 즉 헤더 버튼 = 필터 바 X 버튼 의
            대칭 트리거. */}
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
          bikePins={bikePins}
          stationPins={stationPins}
          bikeActiveRiderById={bikeActiveRiderById}
          riderInfoById={riderInfoById}
          onSelect={handleSearchSelect}
        />
        <span className="fullscreen-map-counts">
          {visibleBikePins.length}대 차량 · {visibleStationPins.length}개 BSS
        </span>
      </header>
      {filtersOpen ? (
        <div className="fullscreen-map-filter-bar">
          {/* 차량/라이더/BSS 필터를 한 줄에 평탄하게 — 각 컨트롤의 wrapper 는
              CSS `display: contents` 로 사라지고, 11개 select 가 같은 flex
              컨테이너의 자식이 되어 단일 가로 행으로 자라난다. 좁은 폭에선
              wrap 으로 자연스럽게 다음 줄로 떨어진다. */}
          <VehicleFilterControls
            filters={vehicleFilters}
            onChange={setVehicleFilters}
            layout="horizontal"
            hideSearch
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
          targetLocation={targetLocation}
          onBikeSelect={setSelectedBikeId}
          // 전체화면은 상단에 floating header (≈ 52px) + 가로 필터 바 (좁은
          // 폭에서 1~2 줄로 wrap, 최대 ≈ 100px 까지) 가 떠 있어, 기본 사방
          // 48px 패딩으로 fit 하면 마커가 그 floating 영역 뒤에 가려진다.
          // top 만 충분히 크게 잡아서 fitBounds 가 마커를 항상 바 아래로
          // 밀어 넣게 한다.
          fitBoundsPadding={FULLSCREEN_FIT_BOUNDS_PADDING}
        />
        <VehicleDetailDialog
          key={detailRow ? (detailRow.vehicle.id ?? detailRow.vehicle.slug) : "none"}
          row={detailRow}
          onClose={() => setSelectedBikeId(null)}
        />
      </main>
    </div>
  );
}

