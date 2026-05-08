import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { mockRiderConnections, type RiderDataResult } from "@/lib/services/rider-data";

/**
 * Pure presentational table-card for the rider list. Pulled out of
 * `/riders/page.tsx` so the same render can be embedded inline on the
 * Overview management hub without duplicating the JSX.
 */
export function RidersPanel({ data }: { data: RiderDataResult }) {
  if (!data.riders.length) {
    return (
      <EmptyState
        actionLabel="라이더 등록"
        description="아직 등록된 라이더가 없습니다. ID 입력 없이 이름과 연락처부터 등록합니다."
        href="/riders/new"
        title="라이더 없음"
      />
    );
  }

  return (
    <div className="table-card">
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
                <td>
                  <Badge tone={rider.status === "활동" ? "active" : "muted"}>{rider.status}</Badge>
                </td>
                <td>
                  {connections
                    ? `${connections.contracts.length ? "계약 있음" : "계약 없음"} · ${connections.insurance.length ? "보험 있음" : "보험 없음"}`
                    : `앱 계정 ${rider.appLinkStatus ?? "UNLINKED"} · 계약/보험 API 후속`}
                </td>
                <td>
                  <Link className="button-secondary" href={`/riders/${rider.slug}`}>
                    보기
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
