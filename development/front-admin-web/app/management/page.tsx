import { VehiclesManagementPanel } from "@/components/management/VehiclesManagementPanel";
import { RidersManagementPanel } from "@/components/management/RidersManagementPanel";
import { MatchingManagementPanel } from "@/components/management/MatchingManagementPanel";
import { DispatchPanel } from "@/components/management/DispatchPanel";
import { StrollerRoundPanel } from "@/components/management/StrollerRoundPanel";
import { BaeminCallPanel } from "@/components/management/BaeminCallPanel";
import { getActiveRoundAction, listOfferedCallsAction } from "@/app/dispatch/actions";
import { listVehiclesAction } from "@/app/management/vehicles/actions";

export const dynamic = "force-dynamic";

export default async function ManagementPage() {
  const [activeRound, offeredCalls, vehiclesPage] = await Promise.all([
    getActiveRoundAction(),
    listOfferedCallsAction(),
    listVehiclesAction()
  ]);

  const deliveryVehicles = vehiclesPage
    .filter((v) => v.serviceType === "DELIVERY")
    .map((v) => ({ id: v.slug, plateNumber: v.plateNumber }));

  return (
    <div className="management-page">
      <VehiclesManagementPanel exportUrl="/api/management/vehicles/export" />
      <RidersManagementPanel exportUrl="/api/management/riders/export" />
      <MatchingManagementPanel exportUrl="/api/management/matching/export" />
      <DispatchPanel exportUrl="/api/management/dispatch/export" />
      <StrollerRoundPanel initialRound={activeRound} />
      <BaeminCallPanel initialOffered={offeredCalls} deliveryVehicles={deliveryVehicles} />
    </div>
  );
}
