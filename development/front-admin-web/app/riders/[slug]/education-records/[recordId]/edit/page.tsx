import { notFound } from "next/navigation";

import { updateRiderEducationRecordAction } from "@/app/riders/[slug]/education-records/actions";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { PageHeader } from "@/components/layout/PageHeader";
import { RiderEducationRecordForm } from "@/components/riders/RiderEducationRecordForm";
import { loadRiderDetail } from "@/lib/services/rider-data";
import { loadRiderEducationRecord } from "@/lib/services/rider-education-record-detail-data";

const statusMessage: Record<string, string> = {
  "save-error": "교육 이력 수정에 실패했습니다. 필수값과 백엔드 연결 상태를 확인하세요.",
  "validation-error": "필수값(교육 종류, 완료일)이 누락되었거나 잘못 입력되었습니다."
};

export default async function EditRiderEducationRecordPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string; recordId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug, recordId }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadRiderDetail(slug);
  if (!detail) {
    notFound();
  }

  const recordResult = await loadRiderEducationRecord(recordId);
  if (!recordResult.data) {
    return (
      <div className="page-container">
        <BackToListLink href={`/riders/${detail.rider.slug}`} />
        <PageHeader
          title="교육 이력 수정"
          description={`${detail.rider.name} (${detail.rider.phone}) 의 교육 이력을 불러오지 못했습니다.`}
        />
        {recordResult.notice ? <p className="notice">{recordResult.notice}</p> : null}
      </div>
    );
  }

  const record = recordResult.data;
  const message = status ? statusMessage[status] : null;
  const action = updateRiderEducationRecordAction.bind(
    null,
    detail.rider.id ?? detail.rider.slug,
    record.id
  );

  return (
    <div className="page-container">
      <BackToListLink href={`/riders/${detail.rider.slug}`} />
      <PageHeader
        title="교육 이력 수정"
        description={`${detail.rider.name} (${detail.rider.phone}) 의 교육 이력을 정정합니다.`}
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      <RiderEducationRecordForm
        action={action}
        backHref={`/riders/${detail.rider.slug}`}
        defaultValues={{
          educationType: record.educationType,
          courseName: record.courseName,
          completedAt: record.completedAt,
          expiresAt: record.expiresAt,
          certificateNo: record.certificateNo,
          issuingAuthority: record.issuingAuthority,
          evidenceUrl: record.evidenceUrl,
          memo: record.memo
        }}
        mode="수정"
      />
    </div>
  );
}
