import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ContractDataResult } from "@/lib/services/contract-data-core";
import type { RiderContract } from "@/types/domain";

/**
 * Pure presentational table-card for the contract list. Pulled out of
 * `/contracts/page.tsx` so the same render can be embedded inline on
 * the Overview management hub.
 */
export function ContractsPanel({ data }: { data: ContractDataResult }) {
  if (!data.contracts.length) {
    return (
      <EmptyState
        actionLabel="계약 등록"
        description="아직 등록된 계약이 없습니다. 라이더/차량/계약양식은 선택 UI로 연결합니다."
        href="/contracts/new"
        title="계약 없음"
      />
    );
  }

  return (
    <div className="table-card">
      <table className="table">
        <thead>
          <tr>
            <th>라이더</th>
            <th>차량</th>
            <th>계약 양식</th>
            <th>시작</th>
            <th>종료</th>
            <th>상태</th>
            <th>상세</th>
          </tr>
        </thead>
        <tbody>
          {data.contracts.map((contract) => (
            <tr key={contract.slug}>
              <td>{contract.riderName}</td>
              <td>{contract.bikeLabel ?? "차량 연결 후 표시"}</td>
              <td>{contract.contractType}</td>
              <td>{contract.startsAt}</td>
              <td>{contract.endsAt}</td>
              <td>
                <Badge tone={badgeTone(contract)}>{contract.status}</Badge>
              </td>
              <td>
                <Link className="button-secondary" href={`/contracts/${contract.slug}`}>
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

export function badgeTone(contract: RiderContract): "active" | "muted" | "outline" {
  if (contract.status === "활성") {
    return "active";
  }

  return contract.status === "초안" ? "muted" : "outline";
}
