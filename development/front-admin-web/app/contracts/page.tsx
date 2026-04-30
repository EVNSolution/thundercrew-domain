import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { loadContractList } from "@/lib/services/contract-data";
import type { RiderContract } from "@/types/domain";

const statusMessage: Record<string, string> = {
  created: "계약이 등록되었습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 대신 mock 화면으로 돌아왔습니다.",
  terminated: "계약이 종료 처리되었습니다.",
  updated: "계약 메모가 수정되었습니다."
};

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, data] = await Promise.all([searchParams, loadContractList()]);
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <PageHeader
        title="계약 관리"
        description="라이더-차량 계약 목록, 등록, 메모 수정과 종료 처리를 관리합니다. 계약 기간은 선택한 계약 양식 기준으로 계산됩니다."
        actionHref="/contracts/new"
        actionLabel="계약 등록"
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {data.notice ? <p className="notice">{data.notice}</p> : null}
      <div className="table-card">
        {data.contracts.length ? (
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
                  <td><Badge tone={badgeTone(contract)}>{contract.status}</Badge></td>
                  <td><Link className="button-secondary" href={`/contracts/${contract.slug}`}>보기</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            actionLabel="계약 등록"
            description="아직 등록된 계약이 없습니다. 라이더/차량/계약양식은 선택 UI로 연결합니다."
            href="/contracts/new"
            title="계약 없음"
          />
        )}
      </div>
    </div>
  );
}

function badgeTone(contract: RiderContract): "active" | "muted" | "outline" {
  if (contract.status === "활성") {
    return "active";
  }

  return contract.status === "초안" ? "muted" : "outline";
}
