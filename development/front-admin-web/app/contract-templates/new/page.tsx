import { createContractTemplateAction } from "@/app/contract-templates/actions";
import { ContractTemplateForm } from "@/components/contract-templates/ContractTemplateForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { loadInsuranceOptions } from "@/lib/services/insurance-options-data";

const statusMessage: Record<string, string> = {
  "save-error": "계약 양식 저장에 실패했습니다. 카테고리·기간·보험 조합과 백엔드 연결 상태를 확인하세요."
};

export default async function NewContractTemplatePage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ status }, insuranceOptions] = await Promise.all([
    searchParams,
    loadInsuranceOptions()
  ]);

  return (
    <div className="page-container">
      <BackToListLink href="/contract-templates" />
      <PageHeader
        title="계약 양식 등록"
        description="구독·렌탈·기타 카테고리에 따라 형태/기간/보험 옵션을 입력합니다. 양식 ID는 DB가 자동 생성합니다."
      />
      <ContractTemplateForm
        action={createContractTemplateAction}
        insuranceOptions={insuranceOptions.options}
        insuranceOptionsNotice={insuranceOptions.notice}
        statusMessage={status ? statusMessage[status] : null}
      />
    </div>
  );
}
