import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { InsuranceDataResult } from "@/lib/services/insurance-data-core";

/**
 * Pure presentational table-card for the insurance list. Pulled out of
 * `/insurance/page.tsx` so the same render can be embedded inline on
 * the Overview management hub.
 */
export function InsurancePanel({ data }: { data: InsuranceDataResult }) {
  if (!data.policies.length) {
    return (
      <EmptyState
        actionLabel="보험 등록"
        description="아직 등록된 보험 연결이 없습니다. 라이더와 보험 항목은 선택 UI로 연결합니다."
        href="/insurance/new"
        title="보험 없음"
      />
    );
  }

  return (
    <div className="table-card">
      <table className="table">
        <thead>
          <tr>
            <th>대상</th>
            <th>구분</th>
            <th>보험 항목</th>
            <th>증권번호</th>
            <th>기간</th>
            <th>상태</th>
            <th>상세</th>
          </tr>
        </thead>
        <tbody>
          {data.policies.map((policy) => (
            <tr key={policy.slug}>
              <td>{policy.holderLabel}</td>
              <td>{policy.targetType}</td>
              <td>{policy.provider}</td>
              <td>{policy.policyNumber}</td>
              <td>
                {policy.startsAt} ~ {policy.endsAt}
              </td>
              <td>
                <Badge tone={policy.status === "정상" ? "active" : "outline"}>{policy.status}</Badge>
              </td>
              <td>
                <Link className="button-secondary" href={`/insurance/${policy.slug}`}>
                  보기
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
