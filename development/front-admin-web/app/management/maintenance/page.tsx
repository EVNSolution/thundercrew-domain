import { MaintenancePanel } from "@/components/management/MaintenancePanel";
import { loadMaintenanceDataset } from "@/lib/services/vehicle-maintenance-data";

export const dynamic = "force-dynamic";

export default async function ManagementMaintenancePage() {
  const { items } = await loadMaintenanceDataset();

  return (
    <div className="management-page">
      <MaintenancePanel items={items} />
    </div>
  );
}
