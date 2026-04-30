import Link from "next/link";
import { notFound } from "next/navigation";

import { removeBikeDeviceInstallationAction } from "@/app/devices/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/FormField";
import { loadBikeDeviceInstallationDetail } from "@/lib/services/device-data";

const statusMessage: Record<string, string> = {
  created: "차량 단말 설치가 등록되었습니다.",
  "mock-removed": "서비스 API가 연결되지 않아 제거 처리를 mock 피드백으로만 처리했습니다.",
  "remove-error": "차량 단말 설치 제거에 실패했습니다. 이미 제거되었거나 제거일시가 설치일시보다 빠른지 확인하세요.",
  removed: "차량 단말 설치가 제거 처리되었습니다."
};

export default async function BikeDeviceInstallationDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadBikeDeviceInstallationDetail(slug);

  if (!detail) {
    notFound();
  }

  const installation = detail.installation;
  const message = status ? statusMessage[status] : null;
  const removeAction = removeBikeDeviceInstallationAction.bind(null, installation.slug);

  return (
    <div className="page-container">
      <PageHeader title="차량 단말 설치 상세" description={`${installation.bikeLabel} · ${installation.deviceLabel}`} />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {detail.notice ? <p className="notice">{detail.notice}</p> : null}
      <section className="content-grid">
        <div className="card">
          <h2>설치 정보</h2>
          <div className="detail-list">
            <div className="detail-row"><span>차량</span><strong>{installation.bikeLabel}</strong></div>
            <div className="detail-row"><span>단말</span><strong>{installation.deviceLabel}</strong></div>
            <div className="detail-row"><span>설치일시</span><strong>{installation.installedAt}</strong></div>
            <div className="detail-row"><span>제거일시</span><strong>{installation.removedAt ?? "설치 중"}</strong></div>
            <div className="detail-row"><span>상태</span><Badge tone={installation.status === "설치 중" ? "active" : "muted"}>{installation.status}</Badge></div>
            <div className="detail-row"><span>운영 메모</span><strong>{installation.memo ?? "없음"}</strong></div>
          </div>
          <div className="form-actions"><Link className="button-secondary" href="/devices">목록</Link></div>
        </div>
        <aside className="detail-panel">
          <h2>설치 제거 처리</h2>
          <form action={removeAction} className="action-panel">
            <Field label="제거일시"><input className="input" name="removedAt" type="datetime-local" /></Field>
            <Field label="제거 메모"><textarea className="input" name="memo" placeholder="교체/탈거 사유" rows={3} /></Field>
            <p className="notice">제거는 이력 보존을 위한 상태 전환입니다. hard delete를 수행하지 않습니다.</p>
            <div className="form-actions"><button className="button-primary" type="submit">설치 제거</button></div>
          </form>
        </aside>
      </section>
    </div>
  );
}
