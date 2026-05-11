import { notFound } from "next/navigation";

import { updateRiderInsuranceAction } from "@/app/riders/[slug]/insurance/actions";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { PageHeader } from "@/components/layout/PageHeader";
import { RiderInsuranceForm } from "@/components/riders/RiderInsuranceForm";
import { loadRiderDetail } from "@/lib/services/rider-data";
import { loadRiderInsuranceDetail } from "@/lib/services/rider-insurance-detail-data";

const statusMessage: Record<string, string> = {
  "save-error": "보험 수정에 실패했습니다. 필수값과 백엔드 연결 상태를 확인하세요."
};

export default async function EditRiderInsurancePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string; insuranceId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug, insuranceId }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadRiderDetail(slug);
  if (!detail) {
    notFound();
  }

  const recordResult = await loadRiderInsuranceDetail(insuranceId);
  if (!recordResult.data) {
    return (
      <div className="page-container">
        <BackToListLink href={`/riders/${detail.rider.slug}`} />
        <PageHeader
          title="보험 수정"
          description={`${detail.rider.name} (${detail.rider.phone}) 의 보험 정보를 불러오지 못했습니다.`}
        />
        {recordResult.notice ? <p className="notice">{recordResult.notice}</p> : null}
      </div>
    );
  }

  const record = recordResult.data;
  const message = status ? statusMessage[status] : null;
  const action = updateRiderInsuranceAction.bind(null, detail.rider.slug, record.id);

  return (
    <div className="page-container">
      <BackToListLink href={`/riders/${detail.rider.slug}`} />
      <PageHeader
        title="보험 수정"
        description={`${detail.rider.name} (${detail.rider.phone}) 의 보험 가입을 수정합니다.`}
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      <RiderInsuranceForm
        action={action}
        backHref={`/riders/${detail.rider.slug}`}
        mode="수정"
        defaultValues={{ memo: record.memo, enabled: record.enabled }}
      />
    </div>
  );
}
