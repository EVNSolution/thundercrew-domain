import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { RiderForm } from "@/components/riders/RiderForm";
import { createRiderAction } from "@/app/riders/actions";

const statusMessage: Record<string, string> = {
  "save-error": "라이더 저장에 실패했습니다. 필수값과 백엔드 연결 상태를 확인하세요."
};

export default async function NewRiderPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;

  return (
    <div className="page-container">
      <BackToListLink href="/riders" />
      <PageHeader title="라이더 등록" description="라이더 ID는 DB에서 자동 생성합니다. 사용자는 이름, 연락처, 소속과 담당 구역만 입력합니다." />
      <RiderForm action={createRiderAction} statusMessage={status ? statusMessage[status] : null} />
    </div>
  );
}
