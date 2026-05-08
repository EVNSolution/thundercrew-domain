import { notFound } from "next/navigation";

import { createRiderEducationRecordAction } from "@/app/riders/[slug]/education-records/actions";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { PageHeader } from "@/components/layout/PageHeader";
import { RiderEducationRecordForm } from "@/components/riders/RiderEducationRecordForm";
import { loadRiderDetail } from "@/lib/services/rider-data";

const statusMessage: Record<string, string> = {
  "save-error": "교육 이력 저장에 실패했습니다. 필수값과 백엔드 연결 상태를 확인하세요.",
  "validation-error": "필수값(교육 종류, 완료일)이 누락되었거나 잘못 입력되었습니다."
};

export default async function NewRiderEducationRecordPage({
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

  const message = status ? statusMessage[status] : null;
  const action = createRiderEducationRecordAction.bind(
    null,
    detail.rider.id ?? detail.rider.slug
  );

  return (
    <div className="page-container">
      <BackToListLink href={`/riders/${detail.rider.slug}`} />
      <PageHeader
        title="교육 이력 등록"
        description={`${detail.rider.name} (${detail.rider.phone}) 의 안전 운행 / 정부 지정 교육 이력을 추가합니다.`}
      />
      {message ? <p className="action-feedback" role="status">{message}</p> : null}
      <RiderEducationRecordForm action={action} backHref={`/riders/${detail.rider.slug}`} />
    </div>
  );
}
