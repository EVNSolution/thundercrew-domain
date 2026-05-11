import type { StationDataResult } from "@/lib/services/station-data";
import type { BatteryStation } from "@/types/domain";

/**
 * Read-only table-card for the station list on `/overview ?tab=stations`.
 * Columns: 주소 / 가능/최대.
 *
 * Operator dropped the standalone 스테이션 (name) column — the address
 * is unique enough to identify the station at a glance. 주소 flexes
 * to fill; 가능/최대 is fixed-width and right-aligned so the digits
 * hug the right edge.
 */
export function StationsPanel({ data }: { data: StationDataResult }) {
  return (
    <div className="table-card">
      <table className="table">
        <colgroup>
          <col />
          <col style={{ width: "100px" }} />
        </colgroup>
        <thead>
          <tr>
            <th>주소</th>
            <th style={{ textAlign: "right" }}>가능/최대</th>
          </tr>
        </thead>
        <tbody>
          {data.stations.length === 0 ? (
            <tr>
              <td colSpan={2} className="muted" style={{ textAlign: "center" }}>
                데이터 없음
              </td>
            </tr>
          ) : null}
          {data.stations.map((station) => (
            <tr key={station.slug}>
              <td>{station.address}</td>
              <td style={{ textAlign: "right" }}>
                <strong>{availableCount(station)}</strong>
                <span aria-hidden="true">/</span>
                {maxCount(station)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
