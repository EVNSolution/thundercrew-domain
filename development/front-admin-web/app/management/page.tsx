import { VehiclesManagementPanel } from "@/components/management/VehiclesManagementPanel";
import { RidersManagementPanel } from "@/components/management/RidersManagementPanel";
import { MatchingManagementPanel } from "@/components/management/MatchingManagementPanel";
import { DispatchPanel } from "@/components/management/DispatchPanel";
import { StrollerRoundPanel } from "@/components/management/StrollerRoundPanel";
import { BaeminCallPanel } from "@/components/management/BaeminCallPanel";
import { ManagementSectionNav } from "@/components/management/ManagementSectionNav";
import { getActiveRoundAction, listOfferedCallsAction } from "@/app/dispatch/actions";
import { listVehiclesAction } from "@/app/management/vehicles/actions";
import { isCleaningServiceType } from "@/lib/services/fleet-simulation";

export const dynamic = "force-dynamic";

export default async function ManagementPage() {
  const [activeRound, offeredCalls, vehiclesPage] = await Promise.all([
    getActiveRoundAction(),
    listOfferedCallsAction(),
    listVehiclesAction()
  ]);

  const deliveryVehicles = vehiclesPage
    .filter((v) => !isCleaningServiceType(v.serviceType))
    .map((v) => ({ id: v.id ?? v.slug, plateNumber: v.plateNumber }));

  return (
    <div className="management-page">
      <ManagementSectionNav />
      <section id="mgmt-vehicles" className="management-anchor">
        <VehiclesManagementPanel exportUrl="/api/management/vehicles/export" />
      </section>
      <section id="mgmt-riders" className="management-anchor">
        <RidersManagementPanel exportUrl="/api/management/riders/export" />
      </section>
      <section id="mgmt-matching" className="management-anchor">
        <MatchingManagementPanel exportUrl="/api/management/matching/export" />
      </section>
      <section id="mgmt-dispatch" className="management-anchor">
        <DispatchPanel exportUrl="/api/management/dispatch/export" />
      </section>
      <section id="mgmt-stroller" className="management-anchor">
        <StrollerRoundPanel initialRound={activeRound} />
      </section>
      <section id="mgmt-baemin" className="management-anchor">
        <BaeminCallPanel initialOffered={offeredCalls} deliveryVehicles={deliveryVehicles} />
      </section>
    </div>
  );
}
