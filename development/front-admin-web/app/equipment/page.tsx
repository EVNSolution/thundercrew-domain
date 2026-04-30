import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { loadEquipmentData } from "@/lib/services/equipment-data";
import type { BikeEquipment } from "@/types/domain";

const statusMessage: Record<string, string> = {
  created: "장비가 등록되었습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 실제 저장 대신 mock 화면으로 돌아왔습니다.",
  removed: "바이크 장비가 제거 처리되었습니다.",
  updated: "장비 정보가 수정되었습니다."
};

export default async function EquipmentPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, data] = await Promise.all([searchParams, loadEquipmentData()]);
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <PageHeader
        actionHref="/equipment/new"
        actionLabel="바이크 장비 등록"
        description="바이크별 장비와 관리 기한을 service-ops API 기준으로 관리합니다."
        title="장비 관리"
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {data.notice ? <p className="notice">{data.notice}</p> : null}
      <section className="content-grid">
        <div>
          <div className="table-card">
            {data.bikeEquipments.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>차량</th>
                    <th>장비</th>
                    <th>모델/시리얼</th>
                    <th>관리 기한</th>
                    <th>상태</th>
                    <th>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bikeEquipments.map((equipment) => (
                    <tr key={equipment.slug}>
                      <td>{equipment.bikeLabel}</td>
                      <td>{equipment.equipmentLabel}<br /><span className="muted-text">{equipment.equipmentTypeName}</span></td>
                      <td>{equipment.modelName ?? "모델 미지정"}<br /><span className="muted-text">{equipment.serialNumber ?? "시리얼 미입력"}</span></td>
                      <td>{equipment.managementDueDate}</td>
                      <td><Badge tone={equipmentTone(equipment)}>{equipment.managementStatus}</Badge></td>
                      <td><Link className="button-secondary" href={`/equipment/${equipment.slug}`}>보기</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                actionLabel="바이크 장비 등록"
                description="아직 등록된 바이크 장비가 없습니다. 차량번호와 장비 종류 선택부터 등록합니다."
                href="/equipment/new"
                title="바이크 장비 없음"
              />
            )}
          </div>
        </div>
        <aside className="detail-panel">
          <h2>장비 종류</h2>
          <p>장비 종류는 운영자가 직접 만들고, 바이크 장비 등록 시 선택 UI로 연결합니다.</p>
          <div className="form-actions" style={{ marginTop: 12 }}>
            <Link className="button-primary" href="/equipment/types/new">장비 종류 등록</Link>
          </div>
          <div className="detail-list" style={{ marginTop: 16 }}>
            {data.equipmentTypes.map((type) => (
              <div className="detail-row" key={type.slug}>
                <span>{type.name}</span>
                <Link className="button-secondary" href={`/equipment/types/${type.slug}`}>{type.enabled ? "사용" : "비활성"}</Link>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function equipmentTone(equipment: BikeEquipment): "active" | "muted" | "outline" {
  if (equipment.managementStatus === "정상") {
    return "active";
  }

  return equipment.managementStatus === "제거됨" ? "muted" : "outline";
}
