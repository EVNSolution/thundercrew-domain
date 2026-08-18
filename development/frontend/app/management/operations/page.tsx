import { DispatchPanel } from "@/components/management/DispatchPanel";
import { SequentialDispatchPanel } from "@/components/management/SequentialDispatchPanel";
import { StrollerRoundPanel } from "@/components/management/StrollerRoundPanel";
import { BaeminCallPanel } from "@/components/management/BaeminCallPanel";
import { ManagementSectionNav } from "@/components/management/ManagementSectionNav";
import {
  getActiveRoundAction,
  listOfferedCallsAction,
  listActiveDispatchOrdersAction
} from "@/app/dispatch/actions";
import { listVehiclesAction } from "@/app/management/vehicles/actions";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "mgmt-baemin", label: "콜 배차" },
  { id: "mgmt-dispatch", label: "단일 배차" },
  { id: "mgmt-sequential", label: "순차 배차" },
  { id: "mgmt-stroller", label: "왕복 배차" }
];

export default async function ManagementOperationsPage() {
  const [activeRound, offeredCalls, vehiclesPage, activeOrders] = await Promise.all([
    getActiveRoundAction(),
    listOfferedCallsAction(),
    listVehiclesAction(),
    listActiveDispatchOrdersAction()
  ]);

  // 배송 콜 후보 = 용도가 배송인 차량 (배차 방식 축은 V59 로 용도에 단일화).
  // 활성 매칭 여부는 백엔드가 수락 시점에 검증한다.
  const deliveryVehicles = vehiclesPage
    .filter((v) => (v.purpose ?? "DELIVERY") === "DELIVERY")
    .map((v) => ({ id: v.id ?? v.slug, plateNumber: v.plateNumber }));

  // 재배정 후보 = 전 차량. 활성 매칭 없는 차량은 백엔드가 거부한다.
  const reassignVehicles = vehiclesPage
    .map((v) => ({ id: v.id ?? v.slug, plateNumber: v.plateNumber }));

  // 활성 배차 모니터용 차량번호 매핑 — 배차의 bikeId(전 차종)를 차량번호로 해석한다.
  const plateById: Record<string, string> = Object.fromEntries(
    vehiclesPage.map((v) => [v.id ?? v.slug, v.plateNumber])
  );

  return (
    <div className="management-page">
      <ManagementSectionNav sections={SECTIONS} />
      <section id="mgmt-baemin" className="management-anchor">
        <BaeminCallPanel initialOffered={offeredCalls} deliveryVehicles={deliveryVehicles} />
      </section>
      <section id="mgmt-dispatch" className="management-anchor">
        <DispatchPanel
          exportUrl="/api/management/dispatch/export"
          activeOrders={activeOrders}
          plateById={plateById}
          reassignVehicles={reassignVehicles}
        />
      </section>
      <section id="mgmt-sequential" className="management-anchor">
        <SequentialDispatchPanel exportUrl="/api/management/dispatch/export" />
      </section>
      <section id="mgmt-stroller" className="management-anchor">
        <StrollerRoundPanel initialRound={activeRound} />
      </section>
    </div>
  );
}
