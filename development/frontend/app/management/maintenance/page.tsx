import { MaintenancePanel } from "@/components/management/MaintenancePanel";
import { VehicleMaintenanceCheckPanel } from "@/components/management/VehicleMaintenanceSection";
import { listVehiclesAction } from "@/app/management/vehicles/actions";
import { loadMaintenanceDataset } from "@/lib/services/vehicle-maintenance-data";

export const dynamic = "force-dynamic";

/**
 * 정비 관리 — 차량별 정비 체크(지도 마커 패널에서 이관) + 정비 품목 카탈로그.
 */
export default async function ManagementMaintenancePage() {
  const [{ items }, vehicles] = await Promise.all([
    loadMaintenanceDataset(),
    listVehiclesAction()
  ]);

  const vehicleOptions = vehicles.map((v) => ({
    id: v.id ?? v.slug,
    plateNumber: v.plateNumber,
    purpose: v.purpose ?? null
  }));

  return (
    <div className="management-page">
      <VehicleMaintenanceCheckPanel vehicles={vehicleOptions} />
      <MaintenancePanel items={items} />
    </div>
  );
}
