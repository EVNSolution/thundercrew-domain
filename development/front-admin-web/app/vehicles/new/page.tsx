import { createVehicleAction } from "@/app/vehicles/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { VehicleForm } from "@/components/vehicles/VehicleForm";

const statusMessage: Record<string, string> = {
  "save-error": "차량 저장에 실패했습니다. 필수값, 중복 차량번호/VIN, 백엔드 연결 상태를 확인하세요."
};

export default async function NewVehiclePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;

  return (
    <div className="page-container">
      <BackToListLink href="/vehicles" />
      <PageHeader title="차량 등록" description="차량 ID는 DB가 자동 생성합니다. 사용자는 차량번호, VIN, 모델, 초기 차체 상태만 입력합니다." />
      <VehicleForm action={createVehicleAction} statusMessage={status ? statusMessage[status] : null} />
    </div>
  );
}
