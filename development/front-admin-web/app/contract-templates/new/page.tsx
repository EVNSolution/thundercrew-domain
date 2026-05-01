import { createContractTemplateAction } from "@/app/contract-templates/actions";
import { ContractTemplateForm } from "@/components/contract-templates/ContractTemplateForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";

const statusMessage: Record<string, string> = {
  "save-error": "계약 양식 저장에 실패했습니다. 이름 중복, 기간 입력, 백엔드 연결 상태를 확인하세요."
};

export default async function NewContractTemplatePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;

  return (
    <div className="page-container">
      <BackToListLink href="/contract-templates" />
      <PageHeader title="계약 양식 등록" description="계약 양식 ID는 DB가 자동 생성합니다. 운영자는 사람이 읽을 수 있는 이름과 기간만 입력합니다." />
      <ContractTemplateForm action={createContractTemplateAction} statusMessage={status ? statusMessage[status] : null} />
    </div>
  );
}
