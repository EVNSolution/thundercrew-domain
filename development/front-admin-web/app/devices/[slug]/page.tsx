import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteDeviceAction } from "@/app/devices/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { Badge } from "@/components/ui/Badge";
import { loadDeviceDetail } from "@/lib/services/device-data";
import { deviceLabel } from "@/lib/services/device-data-core";

const statusMessage: Record<string, string> = {
  created: "단말이 등록되었습니다.",
  "delete-error": "단말 비활성 삭제에 실패했습니다. 활성 차량 설치가 있는지 확인하세요.",
  "mock-deleted": "서비스 API가 연결되지 않아 삭제 처리를 mock 피드백으로만 처리했습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 mock 단말 화면으로 돌아왔습니다.",
  updated: "단말 정보가 수정되었습니다."
};

export default async function DeviceDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadDeviceDetail(slug);

  if (!detail) {
    notFound();
  }

  const device = detail.device;
  const message = status ? statusMessage[status] : null;
  const deleteAction = deleteDeviceAction.bind(null, device.slug);

  return (
    <div className="page-container">
      <BackToListLink href="/devices" />
      <PageHeader title={device.deviceUid} description={deviceLabel(device)} actionHref={`/devices/${device.slug}/edit`} actionLabel="수정" />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {detail.notice ? <p className="notice">{detail.notice}</p> : null}
      <section className="content-grid">
        <div className="card">
          <h2>단말 정보</h2>
          <div className="detail-list">
            <div className="detail-row"><span>단말 UID</span><strong>{device.deviceUid}</strong></div>
            <div className="detail-row"><span>제조사</span><strong>{device.manufacturer ?? "미입력"}</strong></div>
            <div className="detail-row"><span>모델명</span><strong>{device.modelName ?? "미입력"}</strong></div>
            <div className="detail-row"><span>사용 상태</span><Badge tone={device.enabled ? "active" : "muted"}>{device.enabled ? "사용" : "비활성"}</Badge></div>
            <div className="detail-row"><span>운영 메모</span><strong>{device.memo ?? "없음"}</strong></div>
          </div>
          <div className="form-actions">
            <Link className="button-secondary" href="/devices">목록</Link>
            <Link className="button-secondary" href={`/devices/${device.slug}/edit`}>기본 정보 수정</Link>
          </div>
        </div>
        <aside className="detail-panel">
          <h2>비활성 삭제</h2>
          <p>활성 차량 설치가 없는 단말만 이력 보존 soft-delete로 비활성 처리합니다.</p>
          <form action={deleteAction} className="action-panel">
            <div className="form-actions"><button className="button-primary" type="submit">단말 비활성 삭제</button></div>
          </form>
        </aside>
      </section>
    </div>
  );
}
