import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteInsuranceItemAction } from "@/app/insurance/items/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { Badge } from "@/components/ui/Badge";
import { loadInsuranceItemDetail } from "@/lib/services/insurance-item-data";

const statusMessage: Record<string, string> = {
  created: "보험 항목이 등록되었습니다.",
  "delete-error": "보험 항목 삭제 처리에 실패했습니다. 활성 라이더 보험 연결이 있거나 백엔드 연결 상태를 확인하세요.",
  "mock-deleted": "서비스 API가 연결되지 않아 삭제 처리를 mock 피드백으로만 처리했습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 mock 보험 항목 화면으로 돌아왔습니다.",
  updated: "보험 항목이 수정되었습니다."
};

export default async function InsuranceItemDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadInsuranceItemDetail(slug);

  if (!detail) {
    notFound();
  }

  const item = detail.item;
  const message = status ? statusMessage[status] : null;
  const deleteAction = deleteInsuranceItemAction.bind(null, item.slug);

  return (
    <div className="page-container">
      <BackToListLink href="/insurance/items" />
      <PageHeader actionHref={`/insurance/items/${item.slug}/edit`} actionLabel="수정" description="라이더 보험 등록 화면에서 선택되는 보험 항목 상세입니다." title={item.name} />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {detail.notice ? <p className="notice">{detail.notice}</p> : null}
      <section className="content-grid">
        <div className="card">
          <h2>보험 항목 정보</h2>
          <div className="detail-list">
            <div className="detail-row"><span>사용 상태</span><Badge tone={item.enabled ? "active" : "muted"}>{item.enabled ? "사용" : "비활성"}</Badge></div>
            <div className="detail-row"><span>설명</span><strong>{item.description ?? "없음"}</strong></div>
            {item.createdAt ? <div className="detail-row"><span>생성일시</span><strong>{item.createdAt}</strong></div> : null}
            {item.updatedAt ? <div className="detail-row"><span>수정일시</span><strong>{item.updatedAt}</strong></div> : null}
          </div>
          <div className="form-actions">
            <Link className="button-secondary" href="/insurance/items">목록</Link>
            <Link className="button-secondary" href={`/insurance/items/${item.slug}/edit`}>기본 정보 수정</Link>
          </div>
        </div>
        <aside className="detail-panel">
          <h2>보험 항목 작업</h2>
          <form action={deleteAction} className="action-panel">
            <p>이 작업은 hard delete가 아니라 백엔드의 soft-delete 흐름입니다. 활성 라이더 보험 연결이 남아 있으면 백엔드가 삭제를 거부합니다.</p>
            <div className="form-actions">
              <Link className="button-secondary" href={`/insurance/items/${item.slug}/edit`}>수정</Link>
              <button className="button-secondary" type="submit">비활성 삭제</button>
            </div>
          </form>
        </aside>
      </section>
    </div>
  );
}
