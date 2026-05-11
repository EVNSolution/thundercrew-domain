import type { StationDataResult } from "@/lib/services/station-data";
import type { BatteryStation } from "@/types/domain";

/**
 * Read-only table-card for the station list on `/overview ?tab=stations`.
 * Columns: 스테이션 / 주소 / 가능/최대.
 */
export function StationsPanel({ data }: { data: StationDataResult }) {
  return (
    <div className="table-card">
      <table className="table">
        <thead>
          <tr>
            <th>스테이션</th>
            <th>주소</th>
            <th>가능/최대</th>
          </tr>
        </thead>
        <tbody>
          {data.stations.length === 0 ? (
            <tr>
              <td colSpan={3} className="muted" style={{ textAlign: "center" }}>
                데이터 없음
              </td>
            </tr>
          ) : null}
          {data.stations.map((station) => (
            <tr key={station.slug}>
              <td>{station.name}</td>
              <td>{station.address}</td>
              <td>
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
