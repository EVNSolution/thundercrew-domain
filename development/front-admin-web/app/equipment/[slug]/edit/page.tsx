import { notFound } from "next/navigation";

import { updateBikeEquipmentAction } from "@/app/equipment/actions";
import { BikeEquipmentForm } from "@/components/equipment/BikeEquipmentForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { loadBikeEquipmentDetail } from "@/lib/services/equipment-data";

const statusMessage: Record<string, string> = {
  "save-error": "바이크 장비 수정에 실패했습니다. 날짜, 중복 시리얼, 백엔드 연결 상태를 확인하세요."
};

export default async function EditBikeEquipmentPage({
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

  const updateAction = updateBikeEquipmentAction.bind(null, slug);

  return (
    <div className="page-container">
      <PageHeader title="바이크 장비 수정" description="장비 표시명, 모델, 시리얼, 관리 기한과 메모만 수정합니다. 차량/장비 종류 변경은 별도 재등록 흐름으로 분리합니다." />
      <BikeEquipmentForm
        action={updateAction}
        cancelHref={`/equipment/${slug}`}
        defaultValues={{
          equipmentLabel: detail.equipment.equipmentLabel,
          managementDueDate: detail.equipment.managementDueDate,
          managementNote: detail.equipment.managementNote,
          memo: detail.equipment.memo,
          modelName: detail.equipment.modelName,
          serialNumber: detail.equipment.serialNumber
        }}
        mode="수정"
        statusMessage={status ? statusMessage[status] : null}
      />
    </div>
  );
}
