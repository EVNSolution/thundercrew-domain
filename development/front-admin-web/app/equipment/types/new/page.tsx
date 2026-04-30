import { createEquipmentTypeAction } from "@/app/equipment/actions";
import { EquipmentTypeForm } from "@/components/equipment/EquipmentTypeForm";
import { PageHeader } from "@/components/layout/PageHeader";

const statusMessage: Record<string, string> = {
  "save-error": "장비 종류 저장에 실패했습니다. 이름 중복 또는 백엔드 연결 상태를 확인하세요."
};

export default async function NewEquipmentTypePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;

  return (
    <div className="page-container">
      <PageHeader title="장비 종류 등록" description="장비 종류 ID는 DB가 자동 생성합니다. 운영자는 이름, 설명, 사용 상태만 입력합니다." />
      <EquipmentTypeForm action={createEquipmentTypeAction} statusMessage={status ? statusMessage[status] : null} />
    </div>
  );
}
