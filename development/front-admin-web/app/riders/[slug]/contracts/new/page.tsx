import { notFound } from "next/navigation";

import { createRiderContractAction } from "@/app/riders/[slug]/contracts/actions";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { PageHeader } from "@/components/layout/PageHeader";
import { RiderContractForm } from "@/components/riders/RiderContractForm";
import { loadRiderDetail } from "@/lib/services/rider-data";
import { loadRiderContractFormOptions } from "@/lib/services/rider-contract-form-options-data";

const statusMessage: Record<string, string> = {
  "save-error": "계약 저장에 실패했습니다. 필수값과 백엔드 연결 상태를 확인하세요.",
  "validation-error": "차량 / 계약 양식 / 시작일을 모두 입력해야 합니다."
};

export default async function NewRiderContractPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadRiderDetail(slug);
  if (!detail) {
    notFound();
  }

  const options = await loadRiderContractFormOptions();
  const message = status ? statusMessage[status] : null;
  const action = createRiderContractAction.bind(
    null,
    detail.rider.slug,
    detail.rider.id ?? detail.rider.slug
  );

  return (
    <div className="page-container">
      <BackToListLink href={`/riders/${detail.rider.slug}`} />
      <PageHeader
        title="계약 등록"
        description={`${detail.rider.name} (${detail.rider.phone}) 의 차량 매칭 계약을 등록합니다.`}
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      <RiderContractForm
        action={action}
        backHref={`/riders/${detail.rider.slug}`}
        mode="등록"
        vehicleOptions={options.vehicles}
        templateOptions={options.templates}
        optionsNotice={options.notice}
      />
    </div>
  );
}
