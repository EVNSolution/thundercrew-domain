"use client";

import type { RiderFilterState } from "@/components/overview/filter-compute";

/**
 * 라이더 필터 6 컨트롤의 presentational 컴포넌트. `VehicleFilterControls` 와
 * 동일 패턴 — `layout="horizontal"` 은 옛 `.vehicles-filter-row` 클래스, `"vertical"` 은
 * 새 `.filter-stack` 클래스로 떨어진다. 클래스 이름이 `vehicles-` 로 시작하는
 * 건 옛 코드와의 호환성 때문 (옛 RidersPanel 도 같은 클래스를 빌려 썼다).
 */
export interface RiderFilterControlsProps {
  filters: RiderFilterState;
  onChange: (next: RiderFilterState) => void;
  layout: "horizontal" | "vertical";
  count?: { visible: number; total: number };
  /** true 면 검색 인풋을 안 그린다. */
  hideSearch?: boolean;
}

export function RiderFilterControls({ filters, onChange, layout, count, hideSearch }: RiderFilterControlsProps) {
  const rowClass = layout === "horizontal" ? "vehicles-filter-row" : "filter-stack";
  return (
    <div className={rowClass}>
      {hideSearch ? null : (
        <div className="vehicles-filter-search-wrap">
          <input
            className="vehicles-filter-search"
            type="search"
            placeholder="이름, 연락처, 차량번호 검색"
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
          />
          <span className="vehicles-filter-search-icon" aria-hidden="true">🔍</span>
        </div>
      )}
      <select
        className="vehicles-filter-select"
        value={filters.education}
        onChange={(event) =>
          onChange({ ...filters, education: event.target.value as RiderFilterState["education"] })
        }
      >
        <option value="ALL">교육: 전체</option>
        <option value="ONLINE">온라인</option>
        <option value="OFFLINE">오프라인</option>
        <option value="NONE">미수료</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.assignment}
        onChange={(event) =>
          onChange({ ...filters, assignment: event.target.value as RiderFilterState["assignment"] })
        }
      >
        <option value="ALL">차량 배정: 전체</option>
        <option value="ASSIGNED">배정됨</option>
        <option value="UNASSIGNED">미배정</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.contractCategory}
        onChange={(event) =>
          onChange({ ...filters, contractCategory: event.target.value as RiderFilterState["contractCategory"] })
        }
      >
        <option value="ALL">구독/렌탈: 전체</option>
        <option value="SUBSCRIPTION">구독</option>
        <option value="RENTAL">렌탈</option>
        <option value="CUSTOM">커스텀</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.insurance}
        onChange={(event) =>
          onChange({ ...filters, insurance: event.target.value as RiderFilterState["insurance"] })
        }
      >
        <option value="ALL">보험: 전체</option>
        <option value="HAS">가입</option>
        <option value="NONE">미가입</option>
      </select>
      <select
        className="vehicles-filter-select"
        value={filters.ignition}
        onChange={(event) =>
          onChange({ ...filters, ignition: event.target.value as RiderFilterState["ignition"] })
        }
      >
        <option value="ALL">시동 상태: 전체</option>
        <option value="ON">ON</option>
        <option value="OFF">OFF</option>
        <option value="UNASSIGNED">차량 미배정</option>
      </select>
      {count ? (
        <span className="vehicles-filter-count">
          {count.visible} / {count.total}
        </span>
      ) : null}
    </div>
  );
}
