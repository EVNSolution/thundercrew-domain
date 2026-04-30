import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { loadRiderDetail } from "@/lib/services/rider-data";

const statusMessage: Record<string, string> = {
  created: "라이더가 등록되었습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 없이 mock 상세로 돌아왔습니다.",
  updated: "라이더 정보가 수정되었습니다."
};

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

  const { contracts, insurance, notice, rider, source } = detail;
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
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
            <div className="detail-row"><span>계약</span><strong>{contracts.join(", ") || "연결 없음"}</strong></div>
            <div className="detail-row"><span>보험</span><strong>{insurance.join(", ") || "연결 없음"}</strong></div>
            <div className="detail-row"><span>메모</span><strong>{rider.memo || "없음"}</strong></div>
          </div>
          <div className="form-actions">
            <Link className="button-secondary" href="/riders">목록</Link>
            <Link className="button-secondary" href="/contracts/new">계약 등록</Link>
            <Link className="button-primary" href="/insurance/new">보험 등록</Link>
          </div>
        </div>
        <aside className="detail-panel">
          <h2>연결 방식</h2>
          <p>계약/보험 연결은 라이더 이름과 연락처 기준 선택 UI를 통해 진행합니다. rider_id 입력 필드는 만들지 않습니다.</p>
          <p className="notice">현재 데이터 소스: {source === "service-ops" ? "service-ops-api" : "mock"}</p>
        </aside>
      </section>
    </div>
  );
}
