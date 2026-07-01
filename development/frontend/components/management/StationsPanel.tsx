"use client";

import { useMemo, useState } from "react";

import { DeleteStationButton } from "@/components/management/DeleteStationButton";
import { StationDetailDialog, type StationDetailRow } from "@/components/management/StationDetailDialog";
import {
  applyStationFilters,
  DEFAULT_STATION_FILTERS,
  type StationFilterState
} from "@/components/overview/filter-compute";
import { StationFilterControls } from "@/components/overview/StationFilterControls";
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

export function StationsPanel({ data }: { data: StationDataResult }) {
  const [activeRow, setActiveRow] = useState<StationDetailRow | null>(null);
  const [filters, setFilters] = useState<StationFilterState>(DEFAULT_STATION_FILTERS);

  const visibleStations = useMemo(
    () => applyStationFilters({ stations: data.stations, filters }),
    [data.stations, filters]
  );

  return (
    <div className="vehicles-panel">
      <StationFilterControls
        filters={filters}
        onChange={setFilters}
        layout="horizontal"
        count={{ visible: visibleStations.length, total: data.stations.length }}
      />

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
