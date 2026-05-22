"use client";

import { useEffect, useMemo, useState } from "react";

import { MapShell } from "@/components/dashboard/MapShell";
import { VehicleDetailDialog, type VehicleDetailRow } from "@/components/management/VehicleDetailDialog";
import { useVehicleFilter } from "@/components/overview/VehicleFilterContext";
import type {
  FrontendDashboardBikePin,
  FrontendDashboardStationPin,
  FrontendVehicle
} from "@/lib/services/service-ops-api";

/**
 * 루트 페이지(`/`) 상단에 박히는 글로벌 "지도 보기" 토글 + 지도.
 *
 * 토글 OFF 상태에선 MapShell 을 mount 하지 않아 NCP 지도 SDK 세션이 생기지
 * 않는다 — 운영자가 지도가 필요 없을 때까지 API 미터를 잡지 않도록.
 *
 * 차량 탭 활성 + 필터 적용 상태에선 `VehicleFilterContext` 의
 * `filteredBikeIds` 로 부분 집합만 마커로 노출. 다른 탭에선 VehiclesPanel 이
 * 언마운트되며 context 가 null 로 되돌아가 전체 핀 복귀.
 *
 * 차량 상세 floating panel:
 *   - 행 클릭(VehiclesPanel) 또는 지도 마커 클릭 → `selectedBikeId` 가 context
 *     에 publish 됨
 *   - 지도가 닫혀 있으면 자동으로 켜지고 그 차량 위치로 pan
 *   - VehicleDetailDialog 를 **지도 캔버스 내부** 우상단에 floating 으로
 *     렌더링 (옛 /monitoring 의 BikeDetailPanel 패턴). 페이지의 다른 영역
 *     (표 / 탭) 과 상호작용을 막지 않는 비-모달
 */
export function OverviewMapBanner({
  bikePins,
  stationPins,
  vehicles,
  bikeActiveRiderById,
  riderInfoById
}: {
  bikePins: ReadonlyArray<FrontendDashboardBikePin>;
  stationPins: ReadonlyArray<FrontendDashboardStationPin>;
  /** 차량 단위 lookup. selectedBikeId 로 FrontendVehicle 을 derive 하는 데 쓴다. */
  vehicles: ReadonlyArray<FrontendVehicle>;
  /** bikeId → 활성 라이더 id. detail panel 의 "이름/연락처" 컬럼 lookup 시작점. */
  bikeActiveRiderById?: Map<string, string>;
  /** riderId → {name, phone}. */
  riderInfoById?: Map<string, { name: string; phone: string }>;
}) {
  const [open, setOpen] = useState(false);
  const { filteredBikeIds, selectedBikeId, setSelectedBikeId } = useVehicleFilter();

  const effectiveBikePins = useMemo(() => {
    if (filteredBikeIds === null) return bikePins;
    return bikePins.filter((pin) => filteredBikeIds.has(pin.bikeId));
  }, [bikePins, filteredBikeIds]);

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

  // 행 클릭이든 마커 클릭이든 selectedBikeId 가 잡히면 지도가 자동으로 켜진다.
  // setState in effect 는 rAF 한 프레임 양보로 회피 (`react-hooks/set-state-in-
  // effect` 규칙).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedBikeId && !open) {
      const handle = window.requestAnimationFrame(() => setOpen(true));
      return () => window.cancelAnimationFrame(handle);
    }
  }, [selectedBikeId, open]);

  const targetLocation = useMemo(() => {
    if (!selectedBikeId) return null;
    const pin = bikePinById.get(selectedBikeId);
    if (!pin) return null;
    // 매 호출마다 새 객체 — MapShell 의 targetLocation effect 가 같은 차량
    // 두 번 클릭에도 재발화.
    return { lat: pin.latitude, lng: pin.longitude };
  }, [selectedBikeId, bikePinById]);

  // VehicleDetailDialog 에 넘길 row 데이터. selectedBikeId 가 잡힌 순간 lookup
  // — vehicle 자체가 없으면(예: 옛 ID 잔존) panel 도 안 뜬다.
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

  const totalLabel =
    filteredBikeIds === null
      ? `${bikePins.length}대 차량`
      : `${effectiveBikePins.length} / ${bikePins.length}대 차량 (필터)`;

  return (
    <section className="overview-map-section" aria-label="지도 보기">
      <div className="overview-map-toggle-row">
        <label className="overview-map-toggle">
          <input
            type="checkbox"
            checked={open}
            onChange={(event) => setOpen(event.target.checked)}
          />
          <span>지도 보기</span>
        </label>
        <span className="overview-map-toggle-hint">
          {totalLabel} · {stationPins.length}개 BSS
        </span>
      </div>
      {open ? (
        <div className="overview-map-canvas">
          <MapShell
            bikePins={[...effectiveBikePins]}
            stationPins={[...stationPins]}
            targetLocation={targetLocation}
            onBikeSelect={setSelectedBikeId}
          />
          {/* 지도 위 floating 상세 패널 — 캔버스 내부 우상단. ESC / 닫기 누르면
              context 의 selectedBikeId 만 해제, 지도는 그대로 둔다. */}
          <VehicleDetailDialog
            key={detailRow ? (detailRow.vehicle.id ?? detailRow.vehicle.slug) : "none"}
            row={detailRow}
            onClose={() => setSelectedBikeId(null)}
          />
        </div>
      ) : null}
    </section>
  );
}
