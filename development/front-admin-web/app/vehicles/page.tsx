import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { loadVehicleList } from "@/lib/services/vehicle-data";

const statusMessage: Record<string, string> = {
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 대신 mock 화면으로 돌아왔습니다.",
  created: "차량이 등록되었습니다.",
  deleted: "차량이 비활성 삭제 처리되었습니다.",
  updated: "차량 기본 정보가 수정되었습니다.",
  "status-updated": "차량 차체 상태가 변경되었습니다."
};

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, data] = await Promise.all([searchParams, loadVehicleList()]);
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <PageHeader
        actionHref="/vehicles/new"
        actionLabel="차량 등록"
        description="차량 기본 정보와 차체 상태를 관리합니다. 배정/단말/관제 데이터는 별도 도메인 API에서 연결합니다."
        title="차량 관리"
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {data.notice ? <p className="notice">{data.notice}</p> : null}
      <div className="filter-bar">
        <input className="input" placeholder="차량번호 또는 모델 검색" />
        <select className="select">
          <option>전체 상태</option>
          <option>대기</option>
          <option>운행 중</option>
          <option>수리</option>
          <option>점검 필요</option>
        </select>
        <button className="button-ghost-mint" type="button">필터 적용</button>
      </div>
      <div className="table-card">
        {data.vehicles.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>차량번호</th>
                <th>모델</th>
                <th>차체 상태</th>
                <th>배정</th>
                <th>배터리</th>
                <th>위치</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {data.vehicles.map((vehicle) => (
                <tr key={vehicle.slug}>
                  <td>{vehicle.plateNumber}</td>
                  <td>{vehicle.model}</td>
                  <td><Badge tone={vehicle.status === "운행 중" ? "active" : vehicle.status === "대기" ? "muted" : "outline"}>{vehicle.status}</Badge></td>
                  <td>{vehicle.riderName ?? vehicle.assignmentStatus}</td>
                  <td>{formatBattery(vehicle.batteryPercent)}</td>
                  <td>{vehicle.locationLabel}</td>
                  <td><Link className="button-secondary" href={`/vehicles/${vehicle.slug}`}>보기</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            actionLabel="차량 등록"
            description="아직 등록된 차량이 없습니다. DB ID 입력 없이 차량번호와 VIN부터 등록합니다."
            href="/vehicles/new"
            title="차량 없음"
          />
        )}
      </div>
    </div>
  );
}

function formatBattery(value: number | null): string {
  return value === null ? "관제 API 후속" : `${value}%`;
}
