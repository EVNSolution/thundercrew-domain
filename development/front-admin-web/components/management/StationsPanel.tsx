"use client";

import { useMemo, useState } from "react";

import { DeleteStationButton } from "@/components/management/DeleteStationButton";
import { StationDetailDialog, type StationDetailRow } from "@/components/management/StationDetailDialog";
import type { StationDataResult } from "@/lib/services/station-data";
import type { BatteryStation } from "@/types/domain";

/**
 * Read-only table-card for the station list on `/?tab=stations`.
 * Columns: 주소 / 잔여·총.
 *
 * 행 클릭 시 상세 다이얼로그가 열리고 거기서 수정으로 전환할 수 있다.
 * 삭제 동작은 상세 다이얼로그 안으로 옮겨 행 자체는 단순한 클릭 영역만
 * 남긴다.
 *
 * `tableLayout: fixed` is required so the <col> widths actually take
 * effect; the default `auto` layout sizes columns by content and
 * ignores width hints, which let 잔여/총 drift toward the middle of
 * the table when address text was short.
 *
 * 필터 바: 주소 substring 검색 + 재고 상태 select 한 줄. 재고 부족 기준은
 * `LOW_STOCK_RATIO` (default 30%) — `available / max` 비율로 판정해서
 * 운영자가 충전이 시급한 스테이션만 골라낼 수 있게.
 */

const LOW_STOCK_RATIO = 0.3;

type FilterState = {
  query: string;
  stock: "ALL" | "OK" | "LOW";
};

const DEFAULT_FILTERS: FilterState = {
  query: "",
  stock: "ALL"
};

export function StationsPanel({ data }: { data: StationDataResult }) {
  const [activeRow, setActiveRow] = useState<StationDetailRow | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const visibleStations = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return data.stations.filter((station) => {
      if (q) {
        if (!station.address.toLowerCase().includes(q)) return false;
      }
      if (filters.stock !== "ALL") {
        const max = maxCount(station);
        const available = availableCount(station);
        // max 가 0 이면 비율 계산 불가 — 운영자 입장에선 "재고 부족" 으로
        // 분류해서 손볼 수 있게 노출. 정상으로 빠지지 않도록 명시적 분기.
        const low = max === 0 || available / max <= LOW_STOCK_RATIO;
        if (filters.stock === "LOW" && !low) return false;
        if (filters.stock === "OK" && low) return false;
      }
      return true;
    });
  }, [data.stations, filters]);

  return (
    <div className="vehicles-panel">
      <div className="vehicles-filter-row">
        <div className="vehicles-filter-search-wrap">
          <input
            className="vehicles-filter-search"
            type="search"
            placeholder="주소 검색"
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
          />
          <span className="vehicles-filter-search-icon" aria-hidden="true">🔍</span>
        </div>
        <select
          className="vehicles-filter-select"
          value={filters.stock}
          onChange={(event) =>
            setFilters({ ...filters, stock: event.target.value as FilterState["stock"] })
          }
        >
          <option value="ALL">잔여 상태: 전체</option>
          <option value="OK">정상</option>
          <option value="LOW">재고 부족 (≤ {Math.round(LOW_STOCK_RATIO * 100)}%)</option>
        </select>
        <span className="vehicles-filter-count">
          {visibleStations.length} / {data.stations.length}
        </span>
      </div>

      <div className="table-card">
        <table className="table" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "48px" }} />
            <col />
            <col style={{ width: "120px" }} />
          </colgroup>
          <thead>
            <tr>
              <th aria-label="삭제" />
              <th>주소</th>
              <th style={{ textAlign: "center" }}>잔여/총</th>
            </tr>
          </thead>
          <tbody>
            {visibleStations.length === 0 ? (
              <tr>
                <td colSpan={3} className="table-empty-cell">
                  조건에 맞는 스테이션 없음
                </td>
              </tr>
            ) : null}
            {visibleStations.map((station) => {
              const available = availableCount(station);
              const max = maxCount(station);
              return (
                <tr
                  key={station.slug}
                  className="table-row-clickable"
                  onClick={() => setActiveRow({ station, available, max })}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    {station.id ? (
                      <DeleteStationButton stationId={station.id} stationLabel={station.address} />
                    ) : null}
                  </td>
                  <td>{station.address}</td>
                  <td style={{ textAlign: "center" }}>
                    <strong>{available}</strong>
                    <span aria-hidden="true">/</span>
                    {max}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <StationDetailDialog
        key={activeRow ? (activeRow.station.id ?? activeRow.station.slug) : "none"}
        row={activeRow}
        onClose={() => setActiveRow(null)}
      />
    </div>
  );
}

/** Number of batteries available to swap right now. */
export function availableCount(station: BatteryStation): number {
  return station.availableBatteryCount ?? station.replaceableCount;
}

/** Maximum slot capacity of the station. */
export function maxCount(station: BatteryStation): number {
  return station.maxBatteryCapacity ?? station.batteryCount;
}
