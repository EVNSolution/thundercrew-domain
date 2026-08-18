import { MaintenancePanel } from "@/components/management/MaintenancePanel";
import {
  VehicleMaintenanceCheckPanel,
  type MaintenanceVehicleRow
} from "@/components/management/VehicleMaintenanceSection";
import { deriveMaintenanceRows } from "@/components/management/vehicle-maintenance-derive";
import { listVehiclesAction } from "@/app/management/vehicles/actions";
import {
  loadMaintenanceDataset,
  loadVehicleMaintenanceBundle
} from "@/lib/services/vehicle-maintenance-data";

export const dynamic = "force-dynamic";

/**
 * 정비 관리 — 차량 리스트에 정비 필요 유무를 선계산해 표시하고, 행 클릭
 * 팝업에서 관리한다. 필요 판정 = 임박(DUE_SOON) 또는 지연(OVERDUE) 항목
 * 존재. 번들 조회는 차량별 병렬.
 */
export default async function ManagementMaintenancePage() {
  const [{ items }, vehicles] = await Promise.all([
    loadMaintenanceDataset(),
    listVehiclesAction()
  ]);

  const rows: MaintenanceVehicleRow[] = await Promise.all(
    vehicles.map(async (v) => {
      const id = v.id ?? v.slug;
      let needsService = false;
      try {
        const bundle = await loadVehicleMaintenanceBundle(id);
        const derived = deriveMaintenanceRows(bundle.items, bundle.records, bundle.currentState ?? null);
        needsService = derived.some((row) => row.status === "DUE_SOON" || row.status === "OVERDUE");
      } catch {
        needsService = false;
      }
      return { id, plateNumber: v.plateNumber, purpose: v.purpose ?? null, needsService };
    })
  );

  return (
    <div className="management-page management-page--fill">
      <VehicleMaintenanceCheckPanel vehicles={rows} />
      <MaintenancePanel items={items} />
    </div>
  );
}
