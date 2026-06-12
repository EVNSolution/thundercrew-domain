import { VehiclesManagementPanel } from "@/components/management/VehiclesManagementPanel";
import { RidersManagementPanel } from "@/components/management/RidersManagementPanel";
import { MatchingManagementPanel } from "@/components/management/MatchingManagementPanel";
import { ManagementSectionNav } from "@/components/management/ManagementSectionNav";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "mgmt-vehicles", label: "차량" },
  { id: "mgmt-riders", label: "라이더" },
  { id: "mgmt-matching", label: "매칭" }
];

export default function ManagementResourcesPage() {
  return (
    <div className="management-page">
      <ManagementSectionNav sections={SECTIONS} />
      <section id="mgmt-vehicles" className="management-anchor">
        <VehiclesManagementPanel exportUrl="/api/management/vehicles/export" />
      </section>
      <section id="mgmt-riders" className="management-anchor">
        <RidersManagementPanel exportUrl="/api/management/riders/export" />
      </section>
      <section id="mgmt-matching" className="management-anchor">
        <MatchingManagementPanel exportUrl="/api/management/matching/export" />
      </section>
    </div>
  );
}
