import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { StationDataResult } from "@/lib/services/station-data-core";
import type { BatteryStation } from "@/types/domain";

/**
 * Pure presentational table-card for the station list. Pulled out of
 * `/stations/page.tsx` so the same render can be embedded inline on the
 * Overview management hub. The mock map preview and summary aside that
 * `/stations` shows alongside the table stay on that page — those are
 * deep-link concerns, not the at-a-glance hub view.
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
            <th>상태</th>
            <th>보유</th>
            <th>교체 가능/최대</th>
            <th>상세</th>
          </tr>
        </thead>
        <tbody>
          {data.stations.map((station) => (
            <tr key={station.slug}>
              <td>{station.name}</td>
              <td>{station.address}</td>
              <td>
                <Badge tone={stationTone(station.status)}>{station.status}</Badge>
              </td>
              <td>{station.batteryCount}개</td>
              <td>
                <strong>{availableLabel(station)}</strong>
              </td>
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

export function availableLabel(station: BatteryStation): string {
  return station.availableBatteryLabel ?? `${station.replaceableCount}/${station.maxBatteryCapacity ?? station.batteryCount}`;
}

export function stationTone(status: BatteryStation["status"]): "active" | "muted" | "outline" {
  if (status === "운영 중") {
    return "active";
  }

  return status === "운영 중지" ? "muted" : "outline";
}
