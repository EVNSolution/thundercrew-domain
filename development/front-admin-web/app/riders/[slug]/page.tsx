import Link from "next/link";
import { notFound } from "next/navigation";

import { terminateRiderContractAction } from "@/app/riders/[slug]/contracts/actions";
import {
  deleteRiderEducationRecordAction
} from "@/app/riders/[slug]/education-records/actions";
import { deleteRiderInsuranceAction } from "@/app/riders/[slug]/insurance/actions";
import { deleteRiderAction } from "@/app/riders/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { Badge } from "@/components/ui/Badge";
import { loadRiderContracts, type RiderContractRow } from "@/lib/services/rider-contract-data";
import { loadRiderDetail } from "@/lib/services/rider-data";
import { loadRiderEducationRecords } from "@/lib/services/rider-education-data";
import { loadRiderInsurances, type RiderInsuranceRow } from "@/lib/services/rider-insurance-data";
import type { ServiceOpsRiderEducationRecord } from "@/lib/services/service-ops-api";

const statusMessage: Record<string, string> = {
  created: "라이더가 등록되었습니다.",
  "created-with-education": "라이더와 첫 교육 이력이 함께 등록되었습니다.",
  "created-education-failed": "라이더는 등록되었지만 첫 교육 이력 저장에 실패했습니다. 아래 표에서 다시 등록해 주세요.",
  "delete-error": "라이더 비활성 삭제에 실패했습니다. 활성 계약/보험 연결이나 백엔드 연결 상태를 확인하세요.",
  "education-created": "교육 이력이 등록되었습니다.",
  "education-deleted": "교육 이력이 삭제되었습니다.",
  "education-delete-error": "교육 이력 삭제에 실패했습니다. 백엔드 연결 상태를 확인하세요.",
  "education-updated": "교육 이력이 수정되었습니다.",
  "contract-created": "계약이 등록되었습니다.",
  "contract-terminated": "계약이 종료 처리되었습니다.",
  "contract-terminate-error": "계약 종료 처리에 실패했습니다. 백엔드 연결 상태를 확인하세요.",
  "contract-updated": "계약 정보가 수정되었습니다.",
  "insurance-created": "보험이 등록되었습니다.",
  "insurance-deleted": "보험이 비활성 삭제 처리되었습니다.",
  "insurance-delete-error": "보험 삭제에 실패했습니다. 백엔드 연결 상태를 확인하세요.",
  "insurance-updated": "보험 정보가 수정되었습니다.",
  "mock-deleted": "서비스 API가 연결되지 않아 삭제 처리를 mock 피드백으로만 처리했습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 없이 mock 상세로 돌아왔습니다.",
  updated: "라이더 정보가 수정되었습니다."
};

/**
 * Slice ④-1c/d expanded the rider create flow with optional sidecar steps
 * (education + insurance + contract). Each sidecar reports independent
 * ok / fail / skip, and the action encodes the trio as
 * `created-x-e<code>-i<code>-c<code>`. Resolve the compact code here so
 * the detail page can show a single, plainly-Korean flash describing
 * what actually happened.
 */
function resolveCompositeCreatedStatus(status: string | undefined): string | null {
  if (!status) return null;
  const match = status.match(/^created-x-e(ok|fail|skip)-i(ok|fail|skip)-c(ok|fail|skip)$/);
  if (!match) return null;
  const [, education, insurance, contract] = match;
  const educationLabel = sidecarOutcomeLabel("교육 이력", education);
  const insuranceLabel = sidecarOutcomeLabel("보험 연결", insurance);
  const contractLabel = sidecarOutcomeLabel("계약", contract);
  return ["라이더가 등록되었습니다.", educationLabel, insuranceLabel, contractLabel]
    .filter(Boolean)
    .join(" ");
}

function sidecarOutcomeLabel(label: string, code: string): string | null {
  switch (code) {
    case "ok":
      return `${label}도 함께 등록되었습니다.`;
    case "fail":
      return `${label} 저장은 실패했습니다 — 라이더 상세에서 다시 등록해 주세요.`;
    default:
      return null;
  }
}

export default async function RiderDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadRiderDetail(slug);

  if (!detail) {
    notFound();
  }

  const { notice, rider } = detail;
  const message = (status ? statusMessage[status] : null) ?? resolveCompositeCreatedStatus(status);
  const deleteAction = deleteRiderAction.bind(null, rider.slug);
  const riderId = rider.id ?? rider.slug;
  const [educationResult, insuranceResult, contractsResult] = await Promise.all([
    loadRiderEducationRecords(riderId),
    loadRiderInsurances(riderId),
    loadRiderContracts(riderId)
  ]);

  return (
    <div className="page-container">
      <BackToListLink href="/overview?tab=riders" />
      <PageHeader
        actionHref={`/riders/${rider.slug}/edit`}
        actionLabel="수정"
        description={`${rider.phone} · ${rider.team} · ${rider.area}`}
        title={rider.name}
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
      <section className="content-grid">
        <div className="card">
          <h2>라이더 정보</h2>
          <div className="detail-list">
            <div className="detail-row"><span>상태</span><Badge>{rider.status}</Badge></div>
            <div className="detail-row"><span>가입일</span><strong>{rider.joinedAt}</strong></div>
            <div className="detail-row"><span>표시 순번</span><strong>{rider.idx ?? "mock"}</strong></div>
            <div className="detail-row"><span>앱 계정</span><strong>{rider.appLinkStatus ?? (rider.status === "활동" ? "LINKED" : "UNLINKED")}</strong></div>
            <div className="detail-row"><span>메모</span><strong>{rider.memo || "없음"}</strong></div>
          </div>
          <div className="form-actions">
            <Link className="button-secondary" href="/overview?tab=riders">목록</Link>
          </div>
        </div>
        <aside className="detail-panel">
          <h2>작업</h2>
          <form action={deleteAction} className="action-panel">
            <div className="form-actions">
              <button className="button-secondary" type="submit">라이더 비활성 삭제</button>
            </div>
          </form>
        </aside>
      </section>
      <RiderEducationSection
        riderId={riderId}
        riderSlug={rider.slug}
        records={educationResult.records}
        notice={educationResult.notice}
        nowMs={educationResult.nowMs}
      />
      <RiderContractSection
        riderSlug={rider.slug}
        rows={contractsResult.rows}
        notice={contractsResult.notice}
      />
      <RiderInsuranceSection
        riderSlug={rider.slug}
        rows={insuranceResult.rows}
        notice={insuranceResult.notice}
      />
    </div>
  );
}

function RiderContractSection({
  riderSlug,
  rows,
  notice
}: {
  riderSlug: string;
  rows: RiderContractRow[];
  notice: string | undefined;
}) {
  return (
    <section className="card" aria-label="라이더 계약">
      <header className="card-header">
        <h2>계약</h2>
        <Link className="button-primary" href={`/riders/${riderSlug}/contracts/new`}>
          계약 등록
        </Link>
      </header>
      {notice ? <p className="notice">{notice}</p> : null}
      {rows.length === 0 ? (
        <p className="muted">등록된 계약 없음</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>차량</th>
              <th>계약 양식</th>
              <th>시작</th>
              <th>종료</th>
              <th>상태</th>
              <th>메모</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const terminateAction = terminateRiderContractAction.bind(null, riderSlug, row.id);
              return (
                <tr key={row.id}>
                  <td>{row.bikeLabel ?? "차량 연결 확인 필요"}</td>
                  <td>{row.templateName ?? "계약 양식 연결 확인 필요"}</td>
                  <td>{formatDate(row.startAt)}</td>
                  <td>{row.terminatedAt ? formatDate(row.terminatedAt) : (row.endAt ? formatDate(row.endAt) : "—")}</td>
                  <td>
                    <Badge tone={row.status === "활성" ? "active" : "muted"}>{row.status}</Badge>
                  </td>
                  <td>{row.memo || "—"}</td>
                  <td>
                    <Link
                      className="button-link"
                      href={`/riders/${riderSlug}/contracts/${row.id}/edit`}
                    >
                      수정
                    </Link>
                    {row.status === "활성" ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        <form action={terminateAction} style={{ display: "inline" }}>
                          <button className="button-link" type="submit">종료</button>
                        </form>
                      </>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function RiderInsuranceSection({
  riderSlug,
  rows,
  notice
}: {
  riderSlug: string;
  rows: RiderInsuranceRow[];
  notice: string | undefined;
}) {
  return (
    <section className="card" aria-label="라이더 보험">
      <header className="card-header">
        <h2>보험</h2>
        <Link className="button-primary" href={`/riders/${riderSlug}/insurance/new`}>
          보험 등록
        </Link>
      </header>
      {notice ? <p className="notice">{notice}</p> : null}
      {rows.length === 0 ? (
        <p className="muted">등록된 보험 없음</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>보험 항목</th>
              <th>상태</th>
              <th>메모</th>
              <th>등록일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const deleteAction = deleteRiderInsuranceAction.bind(null, riderSlug, row.id);
              return (
                <tr key={row.id}>
                  <td>{row.insuranceItemName ?? "보험 항목 연결 확인 필요"}</td>
                  <td>
                    <Badge tone={row.enabled ? "active" : "muted"}>
                      {row.enabled ? "정상" : "비활성"}
                    </Badge>
                  </td>
                  <td>{row.memo || "—"}</td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>
                    <Link
                      className="button-link"
                      href={`/riders/${riderSlug}/insurance/${row.id}/edit`}
                    >
                      수정
                    </Link>
                    <span aria-hidden="true"> · </span>
                    <form action={deleteAction} style={{ display: "inline" }}>
                      <button className="button-link" type="submit">삭제</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function RiderEducationSection({
  riderId,
  riderSlug,
  records,
  notice,
  nowMs
}: {
  riderId: string;
  riderSlug: string;
  records: ServiceOpsRiderEducationRecord[];
  notice: string | undefined;
  nowMs: number;
}) {
  return (
    <section className="card" aria-label="라이더 교육 이력">
      <header className="card-header">
        <h2>교육 이력</h2>
        <Link className="button-primary" href={`/riders/${riderSlug}/education-records/new`}>
          교육 이력 등록
        </Link>
      </header>
      {notice ? <p className="notice">{notice}</p> : null}
      {records.length === 0 ? (
        <p className="muted">등록된 교육 이력 없음</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>종류</th>
              <th>과정명</th>
              <th>완료일</th>
              <th>만료일</th>
              <th>수료증</th>
              <th>발급 기관</th>
              <th>상태</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const expired = isRecordExpired(record, nowMs);
              const deleteAction = deleteRiderEducationRecordAction.bind(null, riderId, record.id);
              return (
                <tr key={record.id}>
                  <td>{record.educationType === "ONLINE" ? "온라인" : "오프라인"}</td>
                  <td>{record.courseName ?? "—"}</td>
                  <td>{formatDate(record.completedAt)}</td>
                  <td>{record.expiresAt ? formatDate(record.expiresAt) : "—"}</td>
                  <td>{record.certificateNo ?? "—"}</td>
                  <td>{record.issuingAuthority ?? "—"}</td>
                  <td>
                    <Badge tone={expired ? "muted" : "active"}>
                      {expired ? "만료" : "유효"}
                    </Badge>
                  </td>
                  <td>
                    <Link
                      className="button-link"
                      href={`/riders/${riderSlug}/education-records/${record.id}/edit`}
                    >
                      수정
                    </Link>
                    <span aria-hidden="true"> · </span>
                    <form action={deleteAction} style={{ display: "inline" }}>
                      <button className="button-link" type="submit">삭제</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function isRecordExpired(record: ServiceOpsRiderEducationRecord, now: number): boolean {
  if (!record.expiresAt) return false;
  const ts = Date.parse(record.expiresAt);
  return Number.isFinite(ts) && ts <= now;
}

function formatDate(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Date(ts).toLocaleDateString("ko-KR");
}
