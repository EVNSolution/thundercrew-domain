import { notFound } from "next/navigation";

import { updateVehicleAction } from "@/app/vehicles/actions";
import { PageHeader } from "@/components/layout/PageHeader";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { loadVehicleDetail } from "@/lib/services/vehicle-data";

const statusMessage: Record<string, string> = {
  "save-error": "차량 수정에 실패했습니다. 필수값, 중복 차량번호/VIN, 백엔드 연결 상태를 확인하세요."
};

export default async function EditVehiclePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ slug }, { status }] = await Promise.all([params, searchParams]);
  const detail = await loadVehicleDetail(slug);

  if (!detail) {
    notFound();
  }

  const updateAction = updateVehicleAction.bind(null, slug);

  return (
    <div className="page-container">
      <PageHeader title="차량 수정" description="차량 기본 정보만 수정합니다. 차체 상태 변경은 상세 화면의 전용 상태 변경 영역을 사용합니다." />
      <VehicleForm
        action={updateAction}
        cancelHref={`/vehicles/${slug}`}
        defaultValues={{
          memo: detail.vehicle.memo,
          model: detail.vehicle.model,
          operationStatus: detail.vehicle.operationStatus,
          plateNumber: detail.vehicle.plateNumber,
          vin: detail.vehicle.vin
        }}
        mode="수정"
        statusMessage={status ? statusMessage[status] : null}
      />
    </div>
  );
}
