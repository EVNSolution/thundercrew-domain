import { VehiclesManagementPanel } from "@/components/management/VehiclesManagementPanel";

export const dynamic = "force-dynamic";

export default function VehiclesManagementPage() {
  return <VehiclesManagementPanel exportUrl="/api/management/vehicles/export" />;
}
