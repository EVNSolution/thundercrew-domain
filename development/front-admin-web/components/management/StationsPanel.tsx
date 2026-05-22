"use client";

import { useState } from "react";

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
 */
export function StationsPanel({ data }: { data: StationDataResult }) {
  const [activeRow, setActiveRow] = useState<StationDetailRow | null>(null);

  return (
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
          {data.stations.length === 0 ? (
            <tr>
              <td colSpan={3} className="table-empty-cell">
                데이터 없음
              </td>
            </tr>
          ) : null}
          {data.stations.map((station) => {
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
