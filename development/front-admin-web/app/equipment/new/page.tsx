import { createBikeEquipmentAction } from "@/app/equipment/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { BikeEquipmentForm } from "@/components/equipment/BikeEquipmentForm";
import { loadEquipmentFormOptions } from "@/lib/services/equipment-data";

const statusMessage: Record<string, string> = {
  "save-error": "바이크 장비 저장에 실패했습니다. 선택값, 날짜, 중복 시리얼, 백엔드 연결 상태를 확인하세요."
};

export default async function NewBikeEquipmentPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, options] = await Promise.all([searchParams, loadEquipmentFormOptions()]);

  return (
    <div className="page-container">
      <BackToListLink href="/equipment" />
      <PageHeader title="바이크 장비 등록" description="차량과 장비 종류는 선택 UI로 연결합니다. DB/FK ID는 직접 입력하지 않습니다." />
      {options.notice ? <p className="notice">{options.notice}</p> : null}
      <BikeEquipmentForm action={createBikeEquipmentAction} equipmentTypes={options.equipmentTypes} statusMessage={status ? statusMessage[status] : null} vehicles={options.vehicles} />
    </div>
  );
}
