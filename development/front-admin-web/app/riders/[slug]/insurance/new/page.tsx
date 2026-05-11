import { notFound } from "next/navigation";

import { createRiderInsuranceAction } from "@/app/riders/[slug]/insurance/actions";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { PageHeader } from "@/components/layout/PageHeader";
import { RiderInsuranceForm } from "@/components/riders/RiderInsuranceForm";
import { loadRiderDetail } from "@/lib/services/rider-data";
import { loadInsuranceOptions } from "@/lib/services/insurance-options-data";

const statusMessage: Record<string, string> = {
  "save-error": "보험 저장에 실패했습니다. 필수값과 백엔드 연결 상태를 확인하세요.",
  "validation-error": "보험 항목 선택이 누락되었습니다."
};

export default async function NewRiderInsurancePage({
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

  const insuranceOptions = await loadInsuranceOptions();
  const message = status ? statusMessage[status] : null;
  const action = createRiderInsuranceAction.bind(
    null,
    detail.rider.slug,
    detail.rider.id ?? detail.rider.slug
  );

  return (
    <div className="page-container">
      <BackToListLink href={`/riders/${detail.rider.slug}`} />
      <PageHeader
        title="보험 등록"
        description={`${detail.rider.name} (${detail.rider.phone}) 의 보험 가입을 등록합니다.`}
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      <RiderInsuranceForm
        action={action}
        backHref={`/riders/${detail.rider.slug}`}
        mode="등록"
        itemOptions={insuranceOptions.options}
        itemOptionsNotice={insuranceOptions.notice}
      />
    </div>
  );
}
