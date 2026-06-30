import { VehiclesManagementPanel } from "@/components/management/VehiclesManagementPanel";
import { RidersManagementPanel } from "@/components/management/RidersManagementPanel";
import { MatchingManagementPanel } from "@/components/management/MatchingManagementPanel";
import { ManagementSectionNav } from "@/components/management/ManagementSectionNav";
import { TelemetryReceiveControl } from "@/components/management/TelemetryReceiveControl";
import { getTelemetryReceiveStatusAction } from "@/app/management/telemetry/actions";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "mgmt-vehicles", label: "차량" },
  { id: "mgmt-riders", label: "라이더" },
  { id: "mgmt-matching", label: "매칭" }
];

export default async function ManagementResourcesPage() {
  const telemetryStatus = await getTelemetryReceiveStatusAction();

  return (
    <div className="management-page">
      <ManagementSectionNav sections={SECTIONS} />
      <TelemetryReceiveControl initialActive={telemetryStatus?.active ?? false} />
      <section id="mgmt-vehicles" className="management-anchor">
        <VehiclesManagementPanel exportUrl="/api/management/vehicles/export" />
      </section>
      <section id="mgmt-riders" className="management-anchor">
        <RidersManagementPanel exportUrl="/api/management/riders/export" />
      </section>
      <section id="mgmt-matching" className="management-anchor">
        <MatchingManagementPanel
          exportUrl="/api/management/matching/export"
          logExportUrl="/api/management/matching/log-export"
        />
      </section>
    </div>
  );
}
