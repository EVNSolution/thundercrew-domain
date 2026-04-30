import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteContractTemplateAction } from "@/app/contract-templates/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { Badge } from "@/components/ui/Badge";
import { loadContractTemplateDetail } from "@/lib/services/contract-template-data";

const statusMessage: Record<string, string> = {
  created: "계약 양식이 등록되었습니다.",
  "delete-error": "계약 양식 삭제 처리에 실패했습니다. 시스템 양식이거나 백엔드 연결 상태를 확인하세요.",
  "mock-deleted": "서비스 API가 연결되지 않아 삭제 처리를 mock 피드백으로만 처리했습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 mock 계약 양식 화면으로 돌아왔습니다.",
  updated: "계약 양식이 수정되었습니다."
};

export default async function ContractTemplateDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadContractTemplateDetail(slug);

  if (!detail) {
    notFound();
  }

  const template = detail.template;
  const message = status ? statusMessage[status] : null;
  const deleteAction = deleteContractTemplateAction.bind(null, template.slug);

  return (
    <div className="page-container">
      <BackToListLink href="/contract-templates" />
      <PageHeader
        actionHref={template.systemTemplate ? undefined : `/contract-templates/${template.slug}/edit`}
        actionLabel={template.systemTemplate ? undefined : "수정"}
        description="계약 등록 화면에서 선택되는 계약 양식 상세입니다. 시스템 양식은 보호되어 수정/삭제하지 않습니다."
        title={template.name}
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {detail.notice ? <p className="notice">{detail.notice}</p> : null}
      <section className="content-grid">
        <div className="card">
          <h2>계약 양식 정보</h2>
          <div className="detail-list">
            <div className="detail-row"><span>기간</span><strong>{template.durationLabel}</strong></div>
            <div className="detail-row"><span>사용 상태</span><Badge tone={template.enabled ? "active" : "muted"}>{template.enabled ? "사용" : "비활성"}</Badge></div>
            <div className="detail-row"><span>보호 상태</span><Badge tone={template.systemTemplate ? "outline" : "muted"}>{template.systemTemplate ? "시스템 보호" : "운영자 관리"}</Badge></div>
            <div className="detail-row"><span>설명</span><strong>{template.description ?? "없음"}</strong></div>
            <div className="detail-row"><span>표시 순번</span><strong>{template.idx ?? "mock"}</strong></div>
            {template.createdAt ? <div className="detail-row"><span>생성일시</span><strong>{template.createdAt}</strong></div> : null}
            {template.updatedAt ? <div className="detail-row"><span>수정일시</span><strong>{template.updatedAt}</strong></div> : null}
          </div>
          <div className="form-actions">
            <Link className="button-secondary" href="/contract-templates">목록</Link>
            {template.systemTemplate ? null : <Link className="button-secondary" href={`/contract-templates/${template.slug}/edit`}>기본 정보 수정</Link>}
          </div>
        </div>
        <aside className="detail-panel">
          <h2>계약 양식 작업</h2>
          {template.systemTemplate ? (
            <p className="notice">시스템 계약 양식은 백엔드 정책상 수정/삭제할 수 없습니다. 운영자용 양식을 새로 만들어 계약 등록 화면에서 선택하세요.</p>
          ) : (
            <form action={deleteAction} className="action-panel">
              <p>이 작업은 hard delete가 아니라 백엔드의 soft-delete 흐름입니다. 기존 계약 이력은 보존하고, 새 계약 등록 선택지에서 제외합니다.</p>
              <div className="form-actions">
                <Link className="button-secondary" href={`/contract-templates/${template.slug}/edit`}>수정</Link>
                <button className="button-secondary" type="submit">비활성 삭제</button>
              </div>
            </form>
          )}
        </aside>
      </section>
    </div>
  );
}
