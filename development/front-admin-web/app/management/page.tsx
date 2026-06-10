import { VehiclesManagementPanel } from "@/components/management/VehiclesManagementPanel";
import { RidersManagementPanel } from "@/components/management/RidersManagementPanel";
import { MatchingManagementPanel } from "@/components/management/MatchingManagementPanel";

export const dynamic = "force-dynamic";

export default function ManagementPage() {
  return (
    <div className="management-page">
      <section>
        <h2 className="management-section-title">차량</h2>
        <VehiclesManagementPanel exportUrl="/api/management/vehicles/export" />
      </section>
      <section>
        <h2 className="management-section-title">라이더</h2>
        <RidersManagementPanel exportUrl="/api/management/riders/export" />
      </section>
      <section>
        <h2 className="management-section-title">매칭</h2>
        <MatchingManagementPanel exportUrl="/api/management/matching/export" />
      </section>
    </div>
  );
}
