import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { loadIntegrityReferenceChecks } from "@/lib/services/integrity-data";
import type { IntegrityFinding } from "@/lib/services/integrity-data-core";

export default async function IntegrityPage() {
  const data = await loadIntegrityReferenceChecks();

  return (
    <div className="page-container">
      <PageHeader
        description="외래키를 강제하지 않는 운영 테이블의 참조 깨짐을 읽기 전용으로 점검합니다. telemetry/current-state 테이블은 이번 범위에서 제외합니다."
        title="무결성 점검"
      />
      {data.notice ? <p className="notice">{data.notice}</p> : null}
      <section className="metric-grid">
        <article className="metric-card">
          <span>전체 발견</span>
          <strong>{data.totalFindings}</strong>
          <small>backend reference-check 원본</small>
        </article>
        <article className="metric-card">
          <span>표시 대상</span>
          <strong>{data.visibleFindingCount}</strong>
          <small>telemetry/current-state 제외</small>
        </article>
        <article className="metric-card">
          <span>제외됨</span>
          <strong>{data.excludedFindingCount}</strong>
          <small>bike_recent/current_states</small>
        </article>
        <article className="metric-card">
          <span>생성 시각</span>
          <strong style={{ fontSize: 18 }}>{formatDateTime(data.generatedAt)}</strong>
          <small>{data.source}</small>
        </article>
      </section>
      <section className="content-grid">
        <div className="table-card">
          {data.findings.length ? <FindingsTable findings={data.findings} /> : (
            <EmptyState
              actionLabel="대시보드로 이동"
              description="표시 대상 운영 참조 깨짐이 없습니다. 이 화면은 수정 기능 없이 조회만 제공합니다."
              href="/dashboard"
              title="무결성 이상 없음"
            />
          )}
        </div>
        <aside className="detail-panel">
          <h2>요약</h2>
          <p>자동 복구나 스케줄러는 후속 이슈 범위입니다. 여기서는 관리자 확인을 위한 read-only 결과만 표시합니다.</p>
          <div className="detail-list" style={{ marginTop: 16 }}>
            {data.summary.length ? data.summary.map((item) => (
              <div className="detail-row" key={item.category}>
                <span>{item.categoryLabel}</span>
                <strong>{item.count}</strong>
              </div>
            )) : <div className="detail-row"><span>표시 대상 findings</span><strong>0</strong></div>}
          </div>
        </aside>
      </section>
    </div>
  );
}

function FindingsTable({ findings }: { findings: IntegrityFinding[] }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>분류</th>
          <th>소스</th>
          <th>참조 필드</th>
          <th>참조 대상</th>
          <th>메시지</th>
        </tr>
      </thead>
      <tbody>
        {findings.map((finding) => (
          <tr key={`${finding.sourceTable}:${finding.sourceId}:${finding.referenceField}:${finding.referenceId}`}>
            <td><Badge tone={finding.severity === "danger" ? "outline" : "muted"}>{finding.categoryLabel}</Badge></td>
            <td>{finding.sourceLabel}<br /><span className="muted-text">IDX {finding.sourceIdx ?? "-"}</span></td>
            <td>{finding.referenceFieldLabel}</td>
            <td>{finding.targetLabel}<br /><span className="muted-text">{finding.referenceId}</span></td>
            <td>{finding.message}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}
