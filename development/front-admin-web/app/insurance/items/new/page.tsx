import { createInsuranceItemAction } from "@/app/insurance/items/actions";
import { InsuranceItemForm } from "@/components/insurance-items/InsuranceItemForm";
import { PageHeader } from "@/components/layout/PageHeader";

const statusMessage: Record<string, string> = {
  "save-error": "보험 항목 저장에 실패했습니다. 이름 중복 또는 백엔드 연결 상태를 확인하세요."
};

export default async function NewInsuranceItemPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;

  return (
    <div className="page-container">
      <PageHeader title="보험 항목 등록" description="보험 항목 ID는 DB가 자동 생성합니다. 운영자는 사람이 읽을 수 있는 보험명과 설명만 입력합니다." />
      <InsuranceItemForm action={createInsuranceItemAction} statusMessage={status ? statusMessage[status] : null} />
    </div>
  );
}
