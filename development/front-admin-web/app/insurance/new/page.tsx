import { createInsuranceAction } from "@/app/insurance/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { InsuranceForm } from "@/components/insurance/InsuranceForm";
import { loadInsuranceFormOptions } from "@/lib/services/insurance-data";

const statusMessage: Record<string, string> = {
  "save-error": "보험 등록에 실패했습니다. 필수 선택값, 중복 연결, 백엔드 연결 상태를 확인하세요."
};

export default async function NewInsurancePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, options] = await Promise.all([searchParams, loadInsuranceFormOptions()]);

  return (
    <div className="page-container">
      <BackToListLink href="/insurance" />
      <PageHeader title="보험 등록" description="보험 ID는 자동 생성합니다. 라이더와 보험 항목은 사람이 읽을 수 있는 선택 UI로 연결합니다." />
      {options.notice ? <p className="notice">{options.notice}</p> : null}
      <InsuranceForm action={createInsuranceAction} options={options} statusMessage={status ? statusMessage[status] : null} />
    </div>
  );
}
