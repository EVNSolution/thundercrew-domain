import { DispatchPanel } from "@/components/management/DispatchPanel";
import { CleaningDispatchPanel } from "@/components/management/CleaningDispatchPanel";
import { BaeminCallPanel } from "@/components/management/BaeminCallPanel";
import { ManagementSectionNav } from "@/components/management/ManagementSectionNav";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { NotificationProvider } from "@/components/layout/NotificationContext";
import {
  listOfferedCallsAction,
  listActiveDispatchOrdersAction
} from "@/app/dispatch/actions";
import { listVehiclesAction } from "@/app/management/vehicles/actions";
import { listMatchingAction } from "@/app/management/matching/actions";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "mgmt-baemin", label: "배송 배차" },
  { id: "mgmt-dispatch", label: "배차 모니터" },
  { id: "mgmt-cleaning", label: "클리닝 배차" },
];

/**
 * 배차 화면 (3단계 재편) — 용도가 배차 방식을 가른다.
 *   배송 배차: 1건 단위 등록(시스템 자동 배정/수락 대기) + 엑셀 + 통합 모니터
 *   클리닝 배차: 서비스 시간 할당 → 예정 시각순 자동 배차 + 일별 일정표
 * 운영자 벨(클리닝 임박/지연 등)을 이 화면에도 띄운다 — 알림의 주 소비처가
 * 배차 운영자이기 때문.
 */
export default async function ManagementOperationsPage() {
  const [offeredCalls, vehiclesPage, activeOrders, contracts] = await Promise.all([
    listOfferedCallsAction(),
    listVehiclesAction(),
    listActiveDispatchOrdersAction(),
    listMatchingAction()
  ]);

  // 배송 콜 후보 = 용도가 배송인 차량. 활성 매칭 여부는 백엔드가 수락 시점에 검증.
  const deliveryVehicles = vehiclesPage
    .filter((v) => (v.purpose ?? "DELIVERY") === "DELIVERY")
    .map((v) => ({ id: v.id ?? v.slug, plateNumber: v.plateNumber }));

  // 클리닝 시간 배차 후보 = 클린차량.
  const cleaningVehicles = vehiclesPage
    .filter((v) => v.purpose === "CLEANING")
    .map((v) => ({ id: v.id ?? v.slug, plateNumber: v.plateNumber }));

  // bikeId → 활성 매칭 이용자 이름 (클리닝 일정표·폼 표시용).
  const cleanerNameByBikeId: Record<string, string> = {};
  for (const c of contracts) {
    if (!c.terminatedAt && c.riderName) {
      cleanerNameByBikeId[c.bikeId] = c.riderName;
    }
  }

  // 재배정 후보 = 전 차량. 활성 매칭 없는 차량은 백엔드가 거부한다.
  const reassignVehicles = vehiclesPage
    .map((v) => ({ id: v.id ?? v.slug, plateNumber: v.plateNumber }));

  const plateById: Record<string, string> = Object.fromEntries(
    vehiclesPage.map((v) => [v.id ?? v.slug, v.plateNumber])
  );

  return (
    <NotificationProvider>
      <div className="management-page">
        <ManagementSectionNav sections={SECTIONS} />
        <div className="operations-bell-row">
          <NotificationBell />
        </div>
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
        <section id="mgmt-cleaning" className="management-anchor">
          <CleaningDispatchPanel
            exportUrl="/api/management/dispatch/export"
            cleaningVehicles={cleaningVehicles}
            cleanerNameByBikeId={cleanerNameByBikeId}
          />
        </section>
      </div>
    </NotificationProvider>
  );
}
