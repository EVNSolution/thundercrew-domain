import { DispatchPanel } from "@/components/management/DispatchPanel";
import { StrollerRoundPanel } from "@/components/management/StrollerRoundPanel";
import { BaeminCallPanel } from "@/components/management/BaeminCallPanel";
import { ManagementSectionNav } from "@/components/management/ManagementSectionNav";
import { getActiveRoundAction, listOfferedCallsAction } from "@/app/dispatch/actions";
import { listVehiclesAction } from "@/app/management/vehicles/actions";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "mgmt-baemin", label: "콜 배차" },
  { id: "mgmt-dispatch", label: "순차 배차" },
  { id: "mgmt-stroller", label: "왕복 배차" }
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
      <ManagementSectionNav sections={SECTIONS} />
      <section id="mgmt-baemin" className="management-anchor">
        <BaeminCallPanel initialOffered={offeredCalls} deliveryVehicles={deliveryVehicles} />
      </section>
      <section id="mgmt-dispatch" className="management-anchor">
        <DispatchPanel exportUrl="/api/management/dispatch/export" />
      </section>
      <section id="mgmt-stroller" className="management-anchor">
        <StrollerRoundPanel initialRound={activeRound} />
      </section>
    </div>
  );
}
