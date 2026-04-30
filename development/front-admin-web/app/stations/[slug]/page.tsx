import Link from "next/link";
import { notFound } from "next/navigation";

import { updateStationBatteryCountsAction } from "@/app/stations/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/FormField";
import { loadStationDetail } from "@/lib/services/station-data";
import type { BatteryStation } from "@/types/domain";

const statusMessage: Record<string, string> = {
  "count-error": "재고 수량 변경에 실패했습니다. 수량 규칙과 백엔드 연결 상태를 확인하세요.",
  "count-updated": "스테이션 재고 수량이 변경되었습니다.",
  created: "스테이션이 등록되었습니다.",
  "mock-count-updated": "서비스 API가 연결되지 않아 재고 변경을 mock 피드백으로만 처리했습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 mock 스테이션 화면으로 돌아왔습니다.",
  updated: "스테이션 기본 정보가 수정되었습니다."
};

export default async function StationDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadStationDetail(slug);

  if (!detail) {
    notFound();
  }

  const station = detail.station;
  const message = status ? statusMessage[status] : null;
  const updateCountsAction = updateStationBatteryCountsAction.bind(null, station.slug);
  const countLogs = detail.countLogs;

  return (
    <div className="page-container">
      <PageHeader title={station.name} description={station.address} actionHref={`/stations/${station.slug}/edit`} actionLabel="수정" />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {detail.notice ? <p className="notice">{detail.notice}</p> : null}
      <section className="content-grid">
        <div className="card">
          <h2>운영 정보</h2>
          <div className="detail-list">
            <div className="detail-row"><span>상태</span><Badge tone={stationTone(station.status)}>{station.status}</Badge></div>
            <div className="detail-row"><span>최대 보관 수량</span><strong>{station.maxBatteryCapacity ?? station.batteryCount}개</strong></div>
            <div className="detail-row"><span>현재 보유 수량</span><strong>{station.currentBatteryCount ?? station.batteryCount}개</strong></div>
            <div className="detail-row"><span>교체 가능/최대</span><strong>{availableLabel(station)}</strong></div>
            <div className="detail-row"><span>가동률</span><strong>{station.capacityPercentage ?? 0}%</strong></div>
            <div className="detail-row"><span>좌표</span><strong>{station.latitude}, {station.longitude}</strong></div>
            {station.memo ? <div className="detail-row"><span>메모</span><strong>{station.memo}</strong></div> : null}
          </div>
          <div className="form-actions">
            <Link className="button-secondary" href="/stations">목록</Link>
            <Link className="button-secondary" href={`/stations/${station.slug}/edit`}>기본 정보 수정</Link>
          </div>
        </div>
        <aside className="detail-panel">
          <h2>재고 수량 변경</h2>
          <form action={updateCountsAction} className="action-panel">
            <Field label="최대 보관 수량"><input className="input" defaultValue={station.maxBatteryCapacity ?? station.batteryCount} min="0" name="maxBatteryCapacity" required type="number" /></Field>
            <Field label="현재 보유 수량"><input className="input" defaultValue={station.currentBatteryCount ?? station.batteryCount} min="0" name="currentBatteryCount" required type="number" /></Field>
            <Field label="교체 가능 수량"><input className="input" defaultValue={station.availableBatteryCount ?? station.replaceableCount} min="0" name="availableBatteryCount" required type="number" /></Field>
            <Field label="변경 사유"><input className="input" maxLength={100} name="reason" placeholder="예: 입고, 출고, 점검 차감" /></Field>
            <Field label="재고 메모"><textarea className="input" name="memo" placeholder="재고 변경 관련 메모" rows={3} /></Field>
            <p className="notice">수량 규칙: 최대 보관 수량 ≥ 현재 보유 수량 ≥ 교체 가능 수량. 이력은 backend 재고 로그로 남깁니다.</p>
            <div className="form-actions"><button className="button-primary" type="submit">재고 변경</button></div>
          </form>
          <br />
          <h2>위치 카드</h2>
          <p>지도 API 없이 주소, 위도/경도, 핀 라벨({station.name} {availableLabel(station)})을 우선 준비합니다.</p>
        </aside>
      </section>
      <section className="card">
        <h2>재고 변경 이력</h2>
        {countLogs.length ? (
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>변경일시</th>
                  <th>최대</th>
                  <th>현재</th>
                  <th>교체 가능</th>
                  <th>사유</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {countLogs.map((row) => (
                  <tr key={`${row.changedAt}-${row.availableChange}-${row.reason}`}>
                    <td>{row.changedAt}</td>
                    <td>{row.maxChange}</td>
                    <td>{row.currentChange}</td>
                    <td>{row.availableChange}</td>
                    <td>{row.reason}</td>
                    <td>{row.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">LOG</div>
            <p>이 스테이션에 표시할 재고 변경 이력이 아직 없습니다.</p>
          </div>
        )}
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
