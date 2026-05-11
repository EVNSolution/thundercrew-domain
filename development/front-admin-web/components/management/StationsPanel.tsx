import type { StationDataResult } from "@/lib/services/station-data";
import type { BatteryStation } from "@/types/domain";

/**
 * Read-only table-card for the station list on `/overview ?tab=stations`.
 * Columns: 주소 / 잔여·총.
 *
 * `tableLayout: fixed` is required so the <col> widths actually take
 * effect; the default `auto` layout sizes columns by content and
 * ignores width hints, which let 잔여/총 drift toward the middle of
 * the table when address text was short.
 */
export function StationsPanel({ data }: { data: StationDataResult }) {
  return (
    <div className="table-card">
      <table className="table" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col />
          <col style={{ width: "140px" }} />
        </colgroup>
        <thead>
          <tr>
            <th>주소</th>
            <th style={{ textAlign: "right", paddingRight: "16px" }}>잔여/총</th>
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
              <td style={{ textAlign: "right", paddingRight: "16px" }}>
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
