"use client";

import { useEffect, useMemo, useState } from "react";

import { MapShell } from "@/components/dashboard/MapShell";
import { useVehicleFilter } from "@/components/overview/VehicleFilterContext";
import type {
  FrontendDashboardBikePin,
  FrontendDashboardStationPin
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
 * 차량 행 클릭 시(VehiclesPanel 이 `selectedBikeId` 를 context 에 publish)
 * 지도가 자동으로 열리고 그 차량 위치로 pan. 이미 열려 있으면 pan 만. 운영자
 * 가 토글로 다시 끄기 전까지 자동으로 닫지 않는다.
 */
export function OverviewMapBanner({
  bikePins,
  stationPins
}: {
  bikePins: ReadonlyArray<FrontendDashboardBikePin>;
  stationPins: ReadonlyArray<FrontendDashboardStationPin>;
}) {
  const [open, setOpen] = useState(false);
  const { filteredBikeIds, selectedBikeId } = useVehicleFilter();

  const effectiveBikePins = useMemo(() => {
    if (filteredBikeIds === null) return bikePins;
    return bikePins.filter((pin) => filteredBikeIds.has(pin.bikeId));
  }, [bikePins, filteredBikeIds]);

  const bikePinById = useMemo(() => {
    const map = new Map<string, FrontendDashboardBikePin>();
    for (const pin of bikePins) map.set(pin.bikeId, pin);
    return map;
  }, [bikePins]);

  // 행 클릭 시 자동으로 토글 ON. setState in effect 는 rAF 한 프레임 양보로
  // 회피 — 같은 commit 안에서 동기 호출하면 lint(`react-hooks/set-state-in-
  // effect`) 가 잡는다.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedBikeId && !open) {
      const handle = window.requestAnimationFrame(() => setOpen(true));
      return () => window.cancelAnimationFrame(handle);
    }
  }, [selectedBikeId, open]);

  // 선택 차량의 위치로 pan. 객체 identity 가 매번 새로 생성되어 MapShell 의
  // targetLocation effect 가 재발화 (같은 차량을 두 번 골라도 다시 panning).
  const targetLocation = useMemo(() => {
    if (!selectedBikeId) return null;
    const pin = bikePinById.get(selectedBikeId);
    if (!pin) return null;
    return { lat: pin.latitude, lng: pin.longitude };
  }, [selectedBikeId, bikePinById]);

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
          />
        </div>
      ) : null}
    </section>
  );
}
