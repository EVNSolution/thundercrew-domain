"use client";

import type { VehicleFilterState } from "@/components/overview/filter-compute";

/**
 * 차량 필터 6 컨트롤의 presentational 컴포넌트. 표(VehiclesPanel) 의
 * 가로 행과 풀스크린 지도 좌측 aside 의 세로 stack 두 layout 을 모두 지원.
 *
 * `layout="horizontal"` 은 옛 `.vehicles-filter-row` 클래스로 떨어지고
 * (현재 표의 모습 그대로), `"vertical"` 은 새 `.filter-stack` 클래스로
 * 세로 정렬된 입력들이 된다.
 */
export interface VehicleFilterControlsProps {
  filters: VehicleFilterState;
  onChange: (next: VehicleFilterState) => void;
  layout: "horizontal" | "vertical";
  count?: { visible: number; total: number };
}

export function VehicleFilterControls({ filters, onChange, layout, count }: VehicleFilterControlsProps) {
  const rowClass = layout === "horizontal" ? "vehicles-filter-row" : "filter-stack";
  return (
    <div className={rowClass}>
      <div className="vehicles-filter-search-wrap">
        <input
          className="vehicles-filter-search"
          type="search"
          placeholder="차량번호, 모델명, IMEI 검색"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
        />
        <span className="vehicles-filter-search-icon" aria-hidden="true">🔍</span>
      </div>
      <select
        className="vehicles-filter-select"
        value={filters.engineType}
        onChange={(event) =>
          onChange({ ...filters, engineType: event.target.value as VehicleFilterState["engineType"] })
        }
      >
        <option value="ALL">구분: 전체</option>
        <option value="ELECTRIC">전기</option>
        <option value="ICE">내연</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.operationStatus}
        onChange={(event) =>
          onChange({ ...filters, operationStatus: event.target.value as VehicleFilterState["operationStatus"] })
        }
      >
        <option value="ALL">운영 상태: 전체</option>
        <option value="IN_SERVICE">운행</option>
        <option value="READY">대기</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.connection}
        onChange={(event) =>
          onChange({ ...filters, connection: event.target.value as VehicleFilterState["connection"] })
        }
      >
        <option value="ALL">연결 상태: 전체</option>
        <option value="ONLINE">온라인</option>
        <option value="ANY_OFFLINE">오프라인/신호끊김</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.ignition}
        onChange={(event) =>
          onChange({ ...filters, ignition: event.target.value as VehicleFilterState["ignition"] })
        }
      >
        <option value="ALL">시동: 전체</option>
        <option value="ON">ON</option>
        <option value="OFF">OFF</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.maintenance}
        onChange={(event) =>
          onChange({ ...filters, maintenance: event.target.value as VehicleFilterState["maintenance"] })
        }
      >
        <option value="ALL">정비 상태: 전체</option>
        <option value="ANY">임박 + 지연</option>
        <option value="DUE_SOON">임박만</option>
        <option value="OVERDUE">지연만</option>
      </select>
      {count ? (
        <span className="vehicles-filter-count">
          {count.visible} / {count.total}
        </span>
      ) : null}
    </div>
  );
}
