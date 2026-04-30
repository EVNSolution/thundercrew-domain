import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteInsuranceAction, updateInsuranceAction } from "@/app/insurance/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/FormField";
import { loadInsuranceDetail } from "@/lib/services/insurance-data";

const statusMessage: Record<string, string> = {
  created: "보험 연결이 등록되었습니다.",
  "delete-error": "보험 연결 비활성 삭제에 실패했습니다. 백엔드 연결 상태를 확인하세요.",
  "mock-deleted": "서비스 API가 연결되지 않아 삭제 처리를 mock 피드백으로만 처리했습니다.",
  "mock-updated": "서비스 API가 연결되지 않아 보험 수정 요청을 mock 피드백으로만 처리했습니다.",
  "save-error": "보험 수정에 실패했습니다. 백엔드 연결 상태를 확인하세요.",
  updated: "보험 연결 정보가 수정되었습니다."
};

export default async function InsuranceDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadInsuranceDetail(slug);

  if (!detail) {
    notFound();
  }

  const policy = detail.policy;
  const message = status ? statusMessage[status] : null;
  const updateAction = updateInsuranceAction.bind(null, slug);
  const deleteAction = deleteInsuranceAction.bind(null, slug);

  return (
    <div className="page-container">
      <PageHeader title={`${policy.provider} 보험`} description={policy.holderLabel} />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {detail.notice ? <p className="notice">{detail.notice}</p> : null}
      <section className="content-grid">
        <div className="card">
          <h2>보험 정보</h2>
          <div className="detail-list">
            <div className="detail-row"><span>대상</span><strong>{policy.holderLabel}</strong></div>
            <div className="detail-row"><span>대상 구분</span><strong>{policy.targetType}</strong></div>
            <div className="detail-row"><span>보험 항목</span><strong>{policy.provider}</strong></div>
            <div className="detail-row"><span>증권번호</span><strong>{policy.policyNumber}</strong></div>
            <div className="detail-row"><span>기간</span><strong>{policy.startsAt} ~ {policy.endsAt}</strong></div>
            <div className="detail-row"><span>상태</span><Badge>{policy.status}</Badge></div>
            {policy.memo ? <div className="detail-row"><span>메모</span><strong>{policy.memo}</strong></div> : null}
          </div>
          <div className="form-actions">
            <Link className="button-secondary" href="/insurance">목록</Link>
            <Link className="button-secondary" href="/insurance/new">새 보험 등록</Link>
          </div>
        </div>
        <aside className="detail-panel">
          <h2>보험 작업</h2>
          <form action={updateAction} className="action-panel">
            <Field label="보험 상태">
              <select className="select" defaultValue={policy.enabled === false ? "false" : "true"} name="enabled">
                <option value="true">정상</option>
                <option value="false">비활성</option>
              </select>
            </Field>
            <Field label="운영 메모"><textarea className="input" defaultValue={policy.memo ?? ""} name="memo" placeholder="보험 연결 관련 운영 메모" rows={4} /></Field>
            <p className="notice">보험 연결 수정은 현재 상세 대상에만 적용됩니다. 라이더/보험 항목 ID를 직접 입력하지 않습니다.</p>
            <div className="form-actions">
              <button className="button-primary" type="submit">변경 저장</button>
            </div>
          </form>
          <form action={deleteAction} className="action-panel">
            <div className="form-actions">
              <button className="button-secondary" type="submit">보험 연결 비활성 삭제</button>
            </div>
          </form>
        </aside>
      </section>
    </div>
  );
}
