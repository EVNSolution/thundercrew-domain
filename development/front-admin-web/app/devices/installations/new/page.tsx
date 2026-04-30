import { createBikeDeviceInstallationAction } from "@/app/devices/actions";
import { BikeDeviceInstallationForm } from "@/components/devices/BikeDeviceInstallationForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackToListLink } from "@/components/layout/BackToListLink";
import { loadDeviceFormOptions } from "@/lib/services/device-data";

const statusMessage: Record<string, string> = {
  "save-error": "차량 단말 설치에 실패했습니다. 차량/단말 선택, 설치일시, 중복 설치 상태를 확인하세요."
};

export default async function NewBikeDeviceInstallationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, options] = await Promise.all([searchParams, loadDeviceFormOptions()]);

  return (
    <div className="page-container">
      <BackToListLink href="/devices" />
      <PageHeader title="차량 단말 설치" description="차량번호와 단말 UID 선택으로 설치/교체합니다. DB ID/FK는 직접 입력하지 않습니다." />
      {options.notice ? <p className="notice">{options.notice}</p> : null}
      <BikeDeviceInstallationForm
        action={createBikeDeviceInstallationAction}
        devices={options.devices}
        statusMessage={status ? statusMessage[status] : null}
        vehicles={options.vehicles}
      />
    </div>
  );
}
