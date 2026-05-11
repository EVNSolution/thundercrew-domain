import { notFound } from "next/navigation";

import { updateRiderContractAction } from "@/app/riders/[slug]/contracts/actions";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { PageHeader } from "@/components/layout/PageHeader";
import { RiderContractForm } from "@/components/riders/RiderContractForm";
import { loadRiderDetail } from "@/lib/services/rider-data";
import { loadRiderContractDetail } from "@/lib/services/rider-contract-detail-data";

const statusMessage: Record<string, string> = {
  "save-error": "계약 수정에 실패했습니다. 필수값과 백엔드 연결 상태를 확인하세요."
};

export default async function EditRiderContractPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string; contractId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug, contractId }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadRiderDetail(slug);
  if (!detail) {
    notFound();
  }

  const recordResult = await loadRiderContractDetail(contractId);
  if (!recordResult.data) {
    return (
      <div className="page-container">
        <BackToListLink href={`/riders/${detail.rider.slug}`} />
        <PageHeader
          title="계약 수정"
          description={`${detail.rider.name} (${detail.rider.phone}) 의 계약 정보를 불러오지 못했습니다.`}
        />
        {recordResult.notice ? <p className="notice">{recordResult.notice}</p> : null}
      </div>
    );
  }

  const record = recordResult.data;
  const message = status ? statusMessage[status] : null;
  const action = updateRiderContractAction.bind(null, detail.rider.slug, record.id);

  return (
    <div className="page-container">
      <BackToListLink href={`/riders/${detail.rider.slug}`} />
      <PageHeader
        title="계약 수정"
        description={`${detail.rider.name} (${detail.rider.phone}) 의 계약 메모를 수정합니다.`}
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      <RiderContractForm
        action={action}
        backHref={`/riders/${detail.rider.slug}`}
        mode="수정"
        defaultValues={{ memo: record.memo }}
      />
    </div>
  );
}
