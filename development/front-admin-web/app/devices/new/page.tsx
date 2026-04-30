import { createDeviceAction } from "@/app/devices/actions";
import { DeviceForm } from "@/components/devices/DeviceForm";
import { PageHeader } from "@/components/layout/PageHeader";

const statusMessage: Record<string, string> = {
  "save-error": "단말 등록에 실패했습니다. 단말 UID 중복 또는 백엔드 연결 상태를 확인하세요."
};

export default async function NewDevicePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;

  return (
    <div className="page-container">
      <PageHeader title="단말 등록" description="단말 자체 UID와 제조사/모델/사용 상태를 등록합니다. DB ID는 직접 입력하지 않습니다." />
      <DeviceForm action={createDeviceAction} statusMessage={status ? statusMessage[status] : null} />
    </div>
  );
}
