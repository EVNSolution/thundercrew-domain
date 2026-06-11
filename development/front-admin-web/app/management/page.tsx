import { VehiclesManagementPanel } from "@/components/management/VehiclesManagementPanel";
import { RidersManagementPanel } from "@/components/management/RidersManagementPanel";
import { MatchingManagementPanel } from "@/components/management/MatchingManagementPanel";
import { DispatchPanel } from "@/components/management/DispatchPanel";
import { StrollerRoundPanel } from "@/components/management/StrollerRoundPanel";
import { getActiveRoundAction } from "@/app/dispatch/actions";

export const dynamic = "force-dynamic";

export default async function ManagementPage() {
  const activeRound = await getActiveRoundAction();

  return (
    <div className="management-page">
      <VehiclesManagementPanel exportUrl="/api/management/vehicles/export" />
      <RidersManagementPanel exportUrl="/api/management/riders/export" />
      <MatchingManagementPanel exportUrl="/api/management/matching/export" />
      <DispatchPanel exportUrl="/api/management/dispatch/export" />
      <StrollerRoundPanel initialRound={activeRound} />
    </div>
  );
}
