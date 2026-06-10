import { VehiclesManagementPanel } from "@/components/management/VehiclesManagementPanel";
import { RidersManagementPanel } from "@/components/management/RidersManagementPanel";
import { MatchingManagementPanel } from "@/components/management/MatchingManagementPanel";

export const dynamic = "force-dynamic";

export default function ManagementPage() {
  return (
    <div className="management-page">
      <VehiclesManagementPanel exportUrl="/api/management/vehicles/export" />
      <RidersManagementPanel exportUrl="/api/management/riders/export" />
      <MatchingManagementPanel exportUrl="/api/management/matching/export" />
    </div>
  );
}
