import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { loadInsuranceList } from "@/lib/services/insurance-data";

const statusMessage: Record<string, string> = {
  created: "보험 연결이 등록되었습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 대신 mock 화면으로 돌아왔습니다.",
  updated: "보험 연결 정보가 수정되었습니다."
};

export default async function InsurancePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, data] = await Promise.all([searchParams, loadInsuranceList()]);
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <PageHeader title="보험 관리" description="라이더 기준 보험 항목 연결과 활성 상태를 관리합니다." actionHref="/insurance/new" actionLabel="보험 등록" />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {data.notice ? <p className="notice">{data.notice}</p> : null}
      <div className="table-card">
        {data.policies.length ? (
          <table className="table">
            <thead><tr><th>대상</th><th>구분</th><th>보험 항목</th><th>증권번호</th><th>기간</th><th>상태</th><th>상세</th></tr></thead>
            <tbody>{data.policies.map((policy) => (
              <tr key={policy.slug}>
                <td>{policy.holderLabel}</td>
                <td>{policy.targetType}</td>
                <td>{policy.provider}</td>
                <td>{policy.policyNumber}</td>
                <td>{policy.startsAt} ~ {policy.endsAt}</td>
                <td><Badge tone={policy.status === "정상" ? "active" : "outline"}>{policy.status}</Badge></td>
                <td><Link className="button-secondary" href={`/insurance/${policy.slug}`}>보기</Link></td>
              </tr>
            ))}</tbody>
          </table>
        ) : (
          <EmptyState actionLabel="보험 등록" description="아직 등록된 보험 연결이 없습니다. 라이더와 보험 항목은 선택 UI로 연결합니다." href="/insurance/new" title="보험 없음" />
        )}
      </div>
    </div>
  );
}
