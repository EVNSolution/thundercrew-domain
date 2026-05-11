import { PageHeader } from "@/components/layout/PageHeader";
import { ManagementSubnav } from "@/components/layout/ManagementSubnav";
import { VehiclesPanel } from "@/components/management/VehiclesPanel";
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
      <ManagementSubnav activeHref="/vehicles" groupKey="vehicles" />
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
      <VehiclesPanel data={data} />
    </div>
  );
}
