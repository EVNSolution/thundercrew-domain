import Link from "next/link";
import { notFound } from "next/navigation";

import { updateEquipmentTypeAction } from "@/app/equipment/actions";
import { EquipmentTypeForm } from "@/components/equipment/EquipmentTypeForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { Badge } from "@/components/ui/Badge";
import { loadEquipmentTypeDetail } from "@/lib/services/equipment-data";

const statusMessage: Record<string, string> = {
  created: "장비 종류가 등록되었습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 mock 장비 종류 화면으로 돌아왔습니다.",
  "save-error": "장비 종류 수정에 실패했습니다. 이름 중복 또는 백엔드 연결 상태를 확인하세요.",
  updated: "장비 종류가 수정되었습니다."
};

export default async function EquipmentTypeDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadEquipmentTypeDetail(slug);

  if (!detail) {
    notFound();
  }

  const equipmentType = detail.equipmentType;
  const updateAction = updateEquipmentTypeAction.bind(null, equipmentType.slug);
  const message = status ? statusMessage[status] : null;

  return (
    <div className="page-container">
      <BackToListLink href="/equipment" />
      <PageHeader title={equipmentType.name} description="장비 종류 상세와 수정 화면입니다." />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {detail.notice ? <p className="notice">{detail.notice}</p> : null}
      <section className="content-grid">
        <div className="card">
          <h2>장비 종류 정보</h2>
          <div className="detail-list">
            <div className="detail-row"><span>사용 상태</span><Badge tone={equipmentType.enabled ? "active" : "muted"}>{equipmentType.enabled ? "사용" : "비활성"}</Badge></div>
            <div className="detail-row"><span>설명</span><strong>{equipmentType.description ?? "없음"}</strong></div>
            <div className="detail-row"><span>표시 순번</span><strong>{equipmentType.idx ?? "mock"}</strong></div>
          </div>
          <div className="form-actions"><Link className="button-secondary" href="/equipment">목록</Link></div>
        </div>
        <EquipmentTypeForm
          action={updateAction}
          cancelHref="/equipment"
          defaultValues={{ description: equipmentType.description, enabled: equipmentType.enabled, name: equipmentType.name }}
          mode="수정"
          statusMessage={status === "save-error" ? statusMessage[status] : null}
        />
      </section>
    </div>
  );
}
