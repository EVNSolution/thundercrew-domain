"use client";

import { LOW_STOCK_RATIO, type StationFilterState } from "@/components/overview/filter-compute";

/**
 * BSS 필터 2 컨트롤. `VehicleFilterControls`/`RiderFilterControls` 와 동일한
 * horizontal/vertical layout 패턴. 클래스 이름이 `vehicles-` 로 시작하는 건
 * 옛 코드와의 호환성 때문 (옛 StationsPanel 도 같은 클래스를 빌려 썼다).
 */
export interface StationFilterControlsProps {
  filters: StationFilterState;
  onChange: (next: StationFilterState) => void;
  layout: "horizontal" | "vertical";
  count?: { visible: number; total: number };
}

export function StationFilterControls({ filters, onChange, layout, count }: StationFilterControlsProps) {
  const rowClass = layout === "horizontal" ? "vehicles-filter-row" : "filter-stack";
  return (
    <div className={rowClass}>
      <div className="vehicles-filter-search-wrap">
        <input
          className="vehicles-filter-search"
          type="search"
          placeholder="주소 검색"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
        />
        <span className="vehicles-filter-search-icon" aria-hidden="true">🔍</span>
      </div>
      <select
        className="vehicles-filter-select"
        value={filters.stock}
        onChange={(event) =>
          onChange({ ...filters, stock: event.target.value as StationFilterState["stock"] })
        }
      >
        <option value="ALL">잔여 상태: 전체</option>
        <option value="OK">정상</option>
        <option value="LOW">재고 부족 (≤ {Math.round(LOW_STOCK_RATIO * 100)}%)</option>
      </select>
      {count ? (
        <span className="vehicles-filter-count">
          {count.visible} / {count.total}
        </span>
      ) : null}
    </div>
  );
}
