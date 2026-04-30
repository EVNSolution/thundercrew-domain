import { createContractAction } from "@/app/contracts/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContractForm } from "@/components/contracts/ContractForm";
import { loadContractFormOptions } from "@/lib/services/contract-data";

const statusMessage: Record<string, string> = {
  "save-error": "계약 등록에 실패했습니다. 필수 선택값, 기간 중복, 백엔드 연결 상태를 확인하세요."
};

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, options] = await Promise.all([searchParams, loadContractFormOptions()]);

  return (
    <div className="page-container">
      <PageHeader title="계약 등록" description="계약 ID는 DB에서 자동 생성합니다. 계약 대상 라이더, 차량, 계약 양식은 사람이 읽을 수 있는 선택 UI로 연결합니다." />
      {options.notice ? <p className="notice">{options.notice}</p> : null}
      <ContractForm action={createContractAction} options={options} statusMessage={status ? statusMessage[status] : null} />
    </div>
  );
}
