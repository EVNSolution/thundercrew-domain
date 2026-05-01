import Link from "next/link";
import { notFound } from "next/navigation";

import { removeBikeEquipmentAction } from "@/app/equipment/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/FormField";
import { loadBikeEquipmentDetail } from "@/lib/services/equipment-data";
import type { BikeEquipment } from "@/types/domain";

const statusMessage: Record<string, string> = {
  created: "바이크 장비가 등록되었습니다.",
  "mock-removed": "서비스 API가 연결되지 않아 제거 처리를 mock 피드백으로만 처리했습니다.",
  "mock-saved": "서비스 API가 연결되지 않아 mock 장비 화면으로 돌아왔습니다.",
  "remove-error": "바이크 장비 제거 처리에 실패했습니다. 이미 제거되었거나 백엔드 연결 상태를 확인하세요.",
  removed: "바이크 장비가 제거 처리되었습니다.",
  updated: "바이크 장비 정보가 수정되었습니다."
};

export default async function BikeEquipmentDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadBikeEquipmentDetail(slug);

  if (!detail) {
    notFound();
  }

  const equipment = detail.equipment;
  const message = status ? statusMessage[status] : null;
  const removeAction = removeBikeEquipmentAction.bind(null, equipment.slug);

  return (
    <div className="page-container">
      <BackToListLink href="/equipment" />
      <PageHeader title={equipment.equipmentLabel} description={`${equipment.bikeLabel} · ${equipment.equipmentTypeName}`} actionHref={`/equipment/${equipment.slug}/edit`} actionLabel="수정" />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      {detail.notice ? <p className="notice">{detail.notice}</p> : null}
      <section className="content-grid">
        <div className="card">
          <h2>장비 정보</h2>
          <div className="detail-list">
            <div className="detail-row"><span>차량</span><strong>{equipment.bikeLabel}</strong></div>
            <div className="detail-row"><span>장비 종류</span><strong>{equipment.equipmentTypeName}</strong></div>
            <div className="detail-row"><span>모델</span><strong>{equipment.modelName ?? "미입력"}</strong></div>
            <div className="detail-row"><span>시리얼</span><strong>{equipment.serialNumber ?? "미입력"}</strong></div>
            <div className="detail-row"><span>설치일시</span><strong>{equipment.installedAt}</strong></div>
            <div className="detail-row"><span>관리 기한</span><strong>{equipment.managementDueDate}</strong></div>
            <div className="detail-row"><span>관리 상태</span><Badge tone={equipmentTone(equipment)}>{equipment.managementStatus}</Badge></div>
            <div className="detail-row"><span>제거일시</span><strong>{equipment.removedAt ?? "장착 중"}</strong></div>
            <div className="detail-row"><span>관리 메모</span><strong>{equipment.managementNote ?? "없음"}</strong></div>
            <div className="detail-row"><span>운영 메모</span><strong>{equipment.memo ?? "없음"}</strong></div>
          </div>
          <div className="form-actions">
            <Link className="button-secondary" href="/equipment">목록</Link>
            <Link className="button-secondary" href={`/equipment/${equipment.slug}/edit`}>기본 정보 수정</Link>
          </div>
        </div>
        <aside className="detail-panel">
          <h2>장비 제거 처리</h2>
          <form action={removeAction} className="action-panel">
            <Field label="제거일시"><input className="input" name="removedAt" type="datetime-local" /></Field>
            <Field label="제거 메모"><textarea className="input" name="memo" placeholder="교체/폐기/탈거 사유" rows={3} /></Field>
            <p className="notice">제거는 이력 보존을 위한 상태 전환입니다. hard delete를 수행하지 않습니다.</p>
            <div className="form-actions"><button className="button-primary" type="submit">제거 처리</button></div>
          </form>
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
