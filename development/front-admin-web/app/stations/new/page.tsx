import { createStationAction } from "@/app/stations/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { StationForm } from "@/components/stations/StationForm";

const statusMessage: Record<string, string> = {
  "save-error": "스테이션 저장에 실패했습니다. 필수값, 좌표 범위, 수량 규칙, 백엔드 연결 상태를 확인하세요."
};

export default async function NewStationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;

  return (
    <div className="page-container">
      <PageHeader title="스테이션 등록" description="스테이션 ID는 DB가 자동 생성합니다. 운영자는 이름, 주소, 좌표, 상태와 재고 수량만 입력합니다." />
      <StationForm action={createStationAction} statusMessage={status ? statusMessage[status] : null} />
    </div>
  );
}
