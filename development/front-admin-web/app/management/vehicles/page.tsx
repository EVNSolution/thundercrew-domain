import { createServiceOpsApiClient } from "@/lib/services/service-ops-api";
import { VehiclesManagementPanel } from "@/components/management/VehiclesManagementPanel";

export const dynamic = "force-dynamic";

export default function VehiclesManagementPage() {
  const exportUrl = createServiceOpsApiClient().getVehiclesExportUrl();
  return <VehiclesManagementPanel exportUrl={exportUrl} />;
}
