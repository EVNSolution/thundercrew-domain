import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import type { StationDataResult } from "@/lib/services/station-data-core";
import type { BatteryStation } from "@/types/domain";

/**
 * Pure presentational table-card for the station list. Pulled out of
 * `/stations/page.tsx` so the same render can be embedded inline on the
 * Overview management hub. The mock map preview and summary aside that
 * `/stations` shows alongside the table stay on that page — those are
 * deep-link concerns, not the at-a-glance hub view.
 *
 * Columns trimmed to the operator-requested set: 스테이션 / 주소 /
 * 가능 / 최대 / 상세. 상태 Badge + 보유 dropped.
 */
export function StationsPanel({ data }: { data: StationDataResult }) {
  if (!data.stations.length) {
    return (
      <EmptyState
        actionLabel="스테이션 등록"
        description="아직 등록된 스테이션이 없습니다. DB ID 입력 없이 이름, 주소, 좌표와 수량부터 등록합니다."
        href="/stations/new"
        title="스테이션 없음"
      />
    );
  }

  return (
    <div className="table-card">
      <table className="table">
        <thead>
          <tr>
            <th>스테이션</th>
            <th>주소</th>
            <th>가능</th>
            <th>최대</th>
            <th>상세</th>
          </tr>
        </thead>
        <tbody>
          {data.stations.map((station) => (
            <tr key={station.slug}>
              <td>{station.name}</td>
              <td>{station.address}</td>
              <td><strong>{availableCount(station)}</strong></td>
              <td>{maxCount(station)}</td>
              <td>
                <Link className="button-secondary" href={`/stations/${station.slug}`}>
                  보기
                </Link>
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

/**
 * Legacy "5/10" label kept for the `/stations` hub page's map preview
 * tooltip which still renders the combined value alongside the marker.
 */
export function availableLabel(station: BatteryStation): string {
  return station.availableBatteryLabel ?? `${availableCount(station)}/${maxCount(station)}`;
}
