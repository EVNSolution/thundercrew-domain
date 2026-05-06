"use client";

import { applyDashboardMode } from "@/components/dashboard/dashboard-mode";
import type { ControlMapRegion } from "@/lib/services/dashboard-map-data";

export function MapZoneSummaryPanel({ region }: { region: ControlMapRegion | null }) {
  if (!region) {
    return (
      <aside className="map-zone-summary map-zone-summary-empty" aria-label="선택된 행정구역 없음">
        <p className="map-zone-summary-empty-title">행정구역이 선택되지 않았습니다</p>
        <p className="map-zone-summary-empty-hint">왼쪽 검색 카드에서 지역을 선택하세요.</p>
      </aside>
    );
  }

  return (
    <aside className="map-zone-summary" aria-label={`${region.name} 관제 요약`}>
      <header className="map-zone-summary-header">
        <p className="map-zone-summary-kicker">Selected zone</p>
        <h2 className="map-zone-summary-title">{region.name}</h2>
      </header>

      <dl className="map-zone-summary-grid">
        <div>
          <dt>운행 차량</dt>
          <dd>{region.activeVehicles}</dd>
        </div>
        <div>
          <dt>활동 라이더</dt>
          <dd>{region.activeRiders}</dd>
        </div>
        <div>
          <dt>스테이션</dt>
          <dd>{region.stations}</dd>
        </div>
        <div>
          <dt>교체 가능</dt>
          <dd>{region.batteries}</dd>
        </div>
      </dl>

      <div className="map-zone-summary-actions">
        <button
          type="button"
          className="button-secondary"
          onClick={() => applyDashboardMode("live")}
        >
          관제로 돌아가기
        </button>
      </div>
    </aside>
  );
}
