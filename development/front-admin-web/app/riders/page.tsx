import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { mockRiderConnections, loadRiderList } from "@/lib/services/rider-data";

const statusMessage: Record<string, string> = {
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 대신 mock 화면으로 돌아왔습니다.",
  created: "라이더가 등록되었습니다.",
  updated: "라이더 정보가 수정되었습니다."
};

export default async function RidersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, data] = await Promise.all([searchParams, loadRiderList()]);
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <PageHeader
        actionHref="/riders/new"
        actionLabel="라이더 등록"
        description="라이더 기본 정보, 소속, 담당 구역과 계약/보험 연결 정보를 조회합니다."
        title="라이더 관리"
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {data.notice ? <p className="notice">{data.notice}</p> : null}
      <div className="table-card">
        {data.riders.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>이름</th>
                <th>연락처</th>
                <th>소속</th>
                <th>구역</th>
                <th>상태</th>
                <th>계약/보험</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {data.riders.map((rider) => {
                const connections = data.source === "mock" ? mockRiderConnections(rider.name) : null;

                return (
                  <tr key={rider.slug}>
                    <td>{rider.name}</td>
                    <td>{rider.phone}</td>
                    <td>{rider.team}</td>
                    <td>{rider.area}</td>
                    <td><Badge tone={rider.status === "활동" ? "active" : "muted"}>{rider.status}</Badge></td>
                    <td>
                      {connections
                        ? `${connections.contracts.length ? "계약 있음" : "계약 없음"} · ${connections.insurance.length ? "보험 있음" : "보험 없음"}`
                        : `앱 계정 ${rider.appLinkStatus ?? "UNLINKED"} · 계약/보험 API 후속`}
                    </td>
                    <td><Link className="button-secondary" href={`/riders/${rider.slug}`}>보기</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState
            actionLabel="라이더 등록"
            description="아직 등록된 라이더가 없습니다. ID 입력 없이 이름과 연락처부터 등록합니다."
            href="/riders/new"
            title="라이더 없음"
          />
        )}
      </div>
    </div>
  );
}
