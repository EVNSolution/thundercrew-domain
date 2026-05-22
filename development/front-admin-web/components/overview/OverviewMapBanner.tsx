"use client";

import { useState } from "react";

import { MapShell } from "@/components/dashboard/MapShell";
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
 */
export function OverviewMapBanner({
  bikePins,
  stationPins
}: {
  bikePins: ReadonlyArray<FrontendDashboardBikePin>;
  stationPins: ReadonlyArray<FrontendDashboardStationPin>;
}) {
  const [open, setOpen] = useState(false);

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
          {bikePins.length}대 차량 · {stationPins.length}개 BSS
        </span>
      </div>
      {open ? (
        <div className="overview-map-canvas">
          <MapShell bikePins={[...bikePins]} stationPins={[...stationPins]} />
        </div>
      ) : null}
    </section>
  );
}
