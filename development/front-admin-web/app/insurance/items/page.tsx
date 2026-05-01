import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { ManagementSubnav } from "@/components/layout/ManagementSubnav";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { loadInsuranceItemList } from "@/lib/services/insurance-item-data";

const statusMessage: Record<string, string> = {
  created: "보험 항목이 등록되었습니다.",
  deleted: "보험 항목이 비활성 삭제 처리되었습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 대신 mock 목록으로 돌아왔습니다.",
  updated: "보험 항목이 수정되었습니다."
};

export default async function InsuranceItemsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, data] = await Promise.all([searchParams, loadInsuranceItemList()]);
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <PageHeader
        actionHref="/insurance/items/new"
        actionLabel="보험 항목 등록"
        description="운영자가 보험 항목을 만들고, 라이더 보험 등록 시 선택 UI로 연결합니다. 보험 항목 ID는 입력받지 않습니다."
        title="보험 항목 관리"
      />
      <ManagementSubnav activeHref="/insurance/items" groupKey="riders" />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {data.notice ? <p className="notice">{data.notice}</p> : null}
      <div className="table-card">
        {data.items.length ? (
          <table className="table">
            <thead>
              <tr><th>보험 항목</th><th>설명</th><th>사용 상태</th><th>상세</th></tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.slug}>
                  <td>{item.name}</td>
                  <td>{item.description ?? "설명 없음"}</td>
                  <td><Badge tone={item.enabled ? "active" : "muted"}>{item.enabled ? "사용" : "비활성"}</Badge></td>
                  <td><Link className="button-secondary" href={`/insurance/items/${item.slug}`}>보기</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState actionLabel="보험 항목 등록" description="아직 등록된 보험 항목이 없습니다. 보험명과 설명부터 정의합니다." href="/insurance/items/new" title="보험 항목 없음" />
        )}
      </div>
    </div>
  );
}
