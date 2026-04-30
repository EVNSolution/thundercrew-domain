import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { loadStationList } from "@/lib/services/station-data";
import type { BatteryStation } from "@/types/domain";

const statusMessage: Record<string, string> = {
  "count-updated": "스테이션 재고 수량이 변경되었습니다.",
  created: "스테이션이 등록되었습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 대신 mock 화면으로 돌아왔습니다.",
  updated: "스테이션 기본 정보가 수정되었습니다."
};

export default async function StationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, data] = await Promise.all([searchParams, loadStationList()]);
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <PageHeader
        actionHref="/stations/new"
        actionLabel="스테이션 등록"
        description="배터리 스테이션의 위치, 운영 상태, 보유/교체 가능 배터리 수량을 service-ops API 기준으로 관리합니다."
        title="배터리 스테이션"
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {data.notice ? <p className="notice">{data.notice}</p> : null}
      <section className="content-grid">
        <div>
          <div className="map-mock" aria-label="스테이션 mock 위치 영역">
            <div className="map-gridline" />
            {data.stations.map((station, index) => (
              <span
                key={station.slug}
                className="map-marker"
                style={{ left: `${24 + index * 24}%`, top: `${36 + index * 14}%` }}
                title={`${station.name} ${availableLabel(station)}`}
              >
                <span className="sr-only">{station.name} {availableLabel(station)}</span>
              </span>
            ))}
          </div>
          <br />
          <div className="table-card">
            {data.stations.length ? (
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
                      <td><Badge tone={stationTone(station.status)}>{station.status}</Badge></td>
                      <td>{station.batteryCount}개</td>
                      <td><strong>{availableLabel(station)}</strong></td>
                      <td><Link className="button-secondary" href={`/stations/${station.slug}`}>보기</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                actionLabel="스테이션 등록"
                description="아직 등록된 스테이션이 없습니다. DB ID 입력 없이 이름, 주소, 좌표와 수량부터 등록합니다."
                href="/stations/new"
                title="스테이션 없음"
              />
            )}
          </div>
        </div>
        <aside className="detail-panel">
          <h2>지도 API 제외 범위</h2>
          <p>이번 범위는 실제 지도 SDK/API를 붙이지 않습니다. 대신 좌표, 주소, 핀 라벨, 카드/리스트/상세 구조만 API 데이터로 준비합니다.</p>
        </aside>
      </section>
    </div>
  );
}

function availableLabel(station: BatteryStation): string {
  return station.availableBatteryLabel ?? `${station.replaceableCount}/${station.maxBatteryCapacity ?? station.batteryCount}`;
}

function stationTone(status: BatteryStation["status"]): "active" | "muted" | "outline" {
  if (status === "운영 중") {
    return "active";
  }

  return status === "운영 중지" ? "muted" : "outline";
}
