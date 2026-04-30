import Link from "next/link";
import { notFound } from "next/navigation";

import { changeVehicleOperationStatusAction, deleteVehicleAction } from "@/app/vehicles/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { vehicleStatusOptions } from "@/components/vehicles/VehicleForm";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/FormField";
import { loadVehicleDetail } from "@/lib/services/vehicle-data";

const statusMessage: Record<string, string> = {
  created: "차량이 등록되었습니다.",
  "delete-error": "차량 비활성 삭제에 실패했습니다. 활성 배정/장비/단말 연결이나 백엔드 연결 상태를 확인하세요.",
  "mock-deleted": "서비스 API가 연결되지 않아 삭제 처리를 mock 피드백으로만 처리했습니다.",
  updated: "차량 기본 정보가 수정되었습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 mock 차량 화면으로 돌아왔습니다.",
  "mock-status-updated": "서비스 API가 연결되지 않아 상태 변경을 mock 피드백으로만 처리했습니다.",
  "status-updated": "차량 차체 상태가 변경되었습니다.",
  "status-error": "차량 상태 변경에 실패했습니다. 필수값과 백엔드 연결 상태를 확인하세요."
};

export default async function VehicleDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadVehicleDetail(slug);

  if (!detail) {
    notFound();
  }

  const vehicle = detail.vehicle;
  const message = status ? statusMessage[status] : null;
  const changeStatusAction = changeVehicleOperationStatusAction.bind(null, vehicle.slug);
  const deleteAction = deleteVehicleAction.bind(null, vehicle.slug);
  const operationHistory = detail.operationHistory;

  return (
    <div className="page-container">
      <BackToListLink href="/vehicles" />
      <PageHeader title={vehicle.plateNumber} description="차량 상세, 기본 정보와 차체 상태 변경 화면입니다." actionHref={`/vehicles/${vehicle.slug}/edit`} actionLabel="수정" />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {detail.notice ? <p className="notice">{detail.notice}</p> : null}
      <section className="content-grid">
        <div className="card">
          <h2>차량 정보</h2>
          <div className="detail-list">
            <div className="detail-row"><span>모델</span><strong>{vehicle.model}</strong></div>
            <div className="detail-row"><span>차대번호/VIN</span><strong>{vehicle.vin ?? "미입력"}</strong></div>
            <div className="detail-row"><span>차체 상태</span><Badge>{vehicle.status}</Badge></div>
            <div className="detail-row"><span>배정</span><strong>{vehicle.riderName ?? vehicle.assignmentStatus}</strong></div>
            <div className="detail-row"><span>배터리</span><strong>{vehicle.batteryPercent === null ? "관제 API 후속" : `${vehicle.batteryPercent}%`}</strong></div>
            <div className="detail-row"><span>위치</span><strong>{vehicle.locationLabel}</strong></div>
            <div className="detail-row"><span>최근 수정</span><strong>{vehicle.lastSeenAt}</strong></div>
            {vehicle.memo ? <div className="detail-row"><span>메모</span><strong>{vehicle.memo}</strong></div> : null}
          </div>
          <div className="form-actions">
            <Link className="button-secondary" href="/vehicles">목록</Link>
            <Link className="button-secondary" href={`/vehicles/${vehicle.slug}/edit`}>기본 정보 수정</Link>
          </div>
        </div>
        <aside className="detail-panel">
          <h2>차체 상태 변경</h2>
          <form action={changeStatusAction} className="action-panel">
            <Field label="변경할 상태">
              <select className="select" defaultValue={vehicle.operationStatus ?? "READY"} name="operationStatus">
                {vehicleStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="변경 사유"><input className="input" maxLength={200} name="reason" placeholder="예: 정비 입고, 운영 투입" /></Field>
            <Field label="상태 메모"><textarea className="input" name="memo" placeholder="상태 변경 관련 메모" rows={3} /></Field>
            <p className="notice">상태 변경은 차량 기본 정보 수정과 분리된 전용 API로 처리합니다.</p>
            <div className="form-actions">
              <button className="button-primary" type="submit">상태 변경</button>
            </div>
          </form>
          <div className="detail-section">
            <h2>비활성 삭제</h2>
            <form action={deleteAction} className="action-panel">
              <div className="form-actions">
                <button className="button-secondary" type="submit">차량 비활성 삭제</button>
              </div>
            </form>
          </div>
        </aside>
      </section>
      <section className="card">
        <h2>차체 상태 변경 이력</h2>
        {operationHistory.length ? (
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>시작</th>
                  <th>종료</th>
                  <th>상태</th>
                  <th>사유</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {operationHistory.map((row) => (
                  <tr key={`${row.startedAt}-${row.statusLabel}-${row.reason}`}>
                    <td>{row.startedAt}</td>
                    <td>{row.endedAt}</td>
                    <td><Badge>{row.statusLabel}</Badge></td>
                    <td>{row.reason}</td>
                    <td>{row.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">LOG</div>
            <p>이 차량에 표시할 차체 상태 변경 이력이 아직 없습니다.</p>
          </div>
        )}
      </section>
    </div>
  );
}
