import { notFound } from "next/navigation";

import { updateRiderAction } from "@/app/riders/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { RiderForm } from "@/components/riders/RiderForm";
import { loadRiderDetail } from "@/lib/services/rider-data";

const statusMessage: Record<string, string> = {
  "save-error": "라이더 수정에 실패했습니다. 필수값과 백엔드 연결 상태를 확인하세요."
};

export default async function EditRiderPage({
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

  const updateAction = updateRiderAction.bind(null, slug);

  return (
    <div className="page-container">
      <BackToListLink href="/riders" />
      <PageHeader title="라이더 수정" description="소속, 구역, 앱 계정 연결 상태를 선택/조회형 입력 중심으로 수정합니다." />
      <RiderForm
        action={updateAction}
        cancelHref={`/riders/${slug}`}
        defaultValues={{
          appLinkStatus: detail.rider.appLinkStatus,
          areaName: detail.rider.area,
          memo: detail.rider.memo,
          name: detail.rider.name,
          phoneNumber: detail.rider.phone,
          teamName: detail.rider.team
        }}
        mode="수정"
        statusMessage={status ? statusMessage[status] : null}
      />
    </div>
  );
}
