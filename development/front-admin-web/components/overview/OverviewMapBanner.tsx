"use client";

import { useMemo, useState } from "react";

import { MapShell } from "@/components/dashboard/MapShell";
import { useVehicleFilter } from "@/components/overview/VehicleFilterContext";
import type {
  FrontendDashboardBikePin,
  FrontendDashboardStationPin
} from "@/lib/services/service-ops-api";

/**
 * 루트 페이지(`/`) 상단에 박히는 글로벌 "지도 보기" 토글 + 지도. 차량 /
 * 라이더 / BSS 탭과 독립적으로 켰다 끌 수 있고, 켜면 차량 마커 + BSS 마커를
 * 한 지도에 띄운다.
 *
 * 탭 전환은 Next.js Link 로 같은 라우트의 query string 만 바꾸므로 이 client
 * 컴포넌트는 mount 가 유지되어 토글 상태도 보존된다. (탭마다 매번 다시
 * 켜야 하는 불편 없음.)
 *
 * 토글 OFF 상태에선 MapShell 을 mount 하지 않아 NCP 지도 SDK 세션이 생기지
 * 않는다 — 운영자가 지도가 필요 없을 때까지 API 미터를 잡지 않도록.
 *
 * 차량 탭 활성 + 필터 적용 상태에선 `VehicleFilterContext` 가 `filteredBikeIds`
 * 를 넘겨 그 부분 집합만 마커로 노출한다. 다른 탭(라이더/BSS)에 가면
 * VehiclesPanel 이 언마운트되며 context 가 null 로 되돌아가 전체 차량 핀이
 * 다시 보인다.
 */
export function OverviewMapBanner({
  bikePins,
  stationPins
}: {
  bikePins: ReadonlyArray<FrontendDashboardBikePin>;
  stationPins: ReadonlyArray<FrontendDashboardStationPin>;
}) {
  const [open, setOpen] = useState(false);
  const { filteredBikeIds } = useVehicleFilter();

  const effectiveBikePins = useMemo(() => {
    if (filteredBikeIds === null) return bikePins;
    return bikePins.filter((pin) => filteredBikeIds.has(pin.bikeId));
  }, [bikePins, filteredBikeIds]);

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
          <MapShell bikePins={[...effectiveBikePins]} stationPins={[...stationPins]} />
        </div>
      ) : null}
    </section>
  );
}
