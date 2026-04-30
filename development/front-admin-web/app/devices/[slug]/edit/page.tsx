import { notFound } from "next/navigation";

import { updateDeviceAction } from "@/app/devices/actions";
import { DeviceForm } from "@/components/devices/DeviceForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { loadDeviceDetail } from "@/lib/services/device-data";

const statusMessage: Record<string, string> = {
  "save-error": "단말 수정에 실패했습니다. 단말 UID 중복 또는 백엔드 연결 상태를 확인하세요."
};

export default async function EditDevicePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadDeviceDetail(slug);

  if (!detail) {
    notFound();
  }

  const updateAction = updateDeviceAction.bind(null, slug);

  return (
    <div className="page-container">
      <PageHeader title="단말 수정" description="단말 UID, 제조사, 모델, 사용 상태와 메모만 수정합니다. 차량 설치 연결은 별도 설치/제거 흐름으로 분리합니다." />
      <DeviceForm
        action={updateAction}
        cancelHref={`/devices/${slug}`}
        defaultValues={{
          deviceUid: detail.device.deviceUid,
          enabled: detail.device.enabled,
          manufacturer: detail.device.manufacturer,
          memo: detail.device.memo,
          modelName: detail.device.modelName
        }}
        mode="수정"
        statusMessage={status ? statusMessage[status] : null}
      />
    </div>
  );
}
