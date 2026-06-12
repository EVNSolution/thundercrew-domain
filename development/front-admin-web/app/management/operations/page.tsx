import { DispatchPanel } from "@/components/management/DispatchPanel";
import { StrollerRoundPanel } from "@/components/management/StrollerRoundPanel";
import { BaeminCallPanel } from "@/components/management/BaeminCallPanel";
import { ManagementSectionNav } from "@/components/management/ManagementSectionNav";
import { ManagementGroupTabs } from "@/components/management/ManagementGroupTabs";
import { getActiveRoundAction, listOfferedCallsAction } from "@/app/dispatch/actions";
import { listVehiclesAction } from "@/app/management/vehicles/actions";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "mgmt-dispatch", label: "배차" },
  { id: "mgmt-stroller", label: "유모차" },
  { id: "mgmt-baemin", label: "배민 콜" }
];

export default async function ManagementOperationsPage() {
  const [activeRound, offeredCalls, vehiclesPage] = await Promise.all([
    getActiveRoundAction(),
    listOfferedCallsAction(),
    listVehiclesAction()
  ]);

  // 배민 콜 후보 차량 = CALL∪SINGLE (systemDispatch 자동 배차 후보와 동일; OTHER·청소형 제외)
  const deliveryVehicles = vehiclesPage
    .filter((v) => v.serviceType === "CALL" || v.serviceType === "SINGLE")
    .map((v) => ({ id: v.id ?? v.slug, plateNumber: v.plateNumber }));

  return (
    <div className="management-page">
      <ManagementGroupTabs />
      <ManagementSectionNav sections={SECTIONS} />
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
