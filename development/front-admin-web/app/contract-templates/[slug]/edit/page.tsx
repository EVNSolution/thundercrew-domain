import Link from "next/link";
import { notFound } from "next/navigation";

import { updateContractTemplateAction } from "@/app/contract-templates/actions";
import { ContractTemplateForm } from "@/components/contract-templates/ContractTemplateForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { loadContractTemplateDetail } from "@/lib/services/contract-template-data";
import { loadInsuranceOptions } from "@/lib/services/insurance-options-data";

const statusMessage: Record<string, string> = {
  "save-error": "계약 양식 수정에 실패했습니다. 이름 중복, 기간 입력, 시스템 양식 여부, 백엔드 연결 상태를 확인하세요."
};

export default async function EditContractTemplatePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }, insuranceOptions] = await Promise.all([
    params,
    searchParams,
    loadInsuranceOptions()
  ]);
  const detail = await loadContractTemplateDetail(slug);

  if (!detail) {
    notFound();
  }

  const template = detail.template;
  const updateAction = updateContractTemplateAction.bind(null, template.slug);

  if (template.systemTemplate) {
    return (
      <div className="page-container">
        <BackToListLink href="/contract-templates" />
        <PageHeader title="시스템 계약 양식" description="시스템 양식은 보호되어 수정할 수 없습니다." />
        <div className="card">
          <p className="notice">{template.name}은 백엔드 정책상 수정/삭제할 수 없는 시스템 계약 양식입니다.</p>
          <div className="form-actions">
            <Link className="button-secondary" href={`/contract-templates/${template.slug}`}>상세로 돌아가기</Link>
            <Link className="button-primary" href="/contract-templates/new">운영자 양식 등록</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <BackToListLink href="/contract-templates" />
      <PageHeader title="계약 양식 수정" description="계약 양식명, 기간, 설명, 사용 상태만 수정합니다. 계약 양식 ID는 입력받지 않습니다." />
      {detail.notice ? <p className="notice">{detail.notice}</p> : null}
      <ContractTemplateForm
        action={updateAction}
        cancelHref={`/contract-templates/${template.slug}`}
        defaultValues={{
          category: template.category,
          defaultInsuranceItemId: template.defaultInsuranceItemId ?? null,
          description: template.description,
          durationMinutes: template.durationMinutes,
          durationUnit: template.durationUnit ?? null,
          durationValue: template.durationValue ?? null,
          enabled: template.enabled,
          includesInsurance: template.includesInsurance ?? false,
          name: template.name,
          returnType: template.returnType ?? null,
          unlimited: template.unlimited
        }}
        insuranceOptions={insuranceOptions.options}
        insuranceOptionsNotice={insuranceOptions.notice}
        mode="수정"
        statusMessage={status ? statusMessage[status] : null}
      />
    </div>
  );
}
