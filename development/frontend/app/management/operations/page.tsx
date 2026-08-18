import { OperationsClient } from "@/components/management/OperationsClient";
import { listOfferedCallsAction } from "@/app/dispatch/actions";
import { listVehiclesAction } from "@/app/management/vehicles/actions";
import { listMatchingAction } from "@/app/management/matching/actions";
import type { ServiceOpsBikePurpose } from "@/lib/services/service-ops-api";

export const dynamic = "force-dynamic";

/**
 * 업무 관리(배차) — 지도와 같은 용도 필터(전체/배송/클리닝) 구조.
 *   배송: 1건 단위 등록(시스템 자동/수락 대기) + 엑셀
 *   클리닝: 시간 할당 → 예정 시각순 자동 배차 + 일별 일정표 + 엑셀
 * 배차 이력(진행 중·당일 완료)은 우측 사이드 리스트로 뜬다 — 행에서 바로
 * 완료/되돌리기/수정/취소. 운영자 벨(클리닝 임박/지연)도 이 화면에 마운트.
 */
export default async function ManagementOperationsPage() {
  const [offeredCalls, vehiclesPage, contracts] = await Promise.all([
    listOfferedCallsAction(),
    listVehiclesAction(),
    listMatchingAction()
  ]);

  const deliveryVehicles = vehiclesPage
    .filter((v) => (v.purpose ?? "DELIVERY") === "DELIVERY")
    .map((v) => ({ id: v.id ?? v.slug, plateNumber: v.plateNumber }));

  const cleaningVehicles = vehiclesPage
    .filter((v) => v.purpose === "CLEANING")
    .map((v) => ({ id: v.id ?? v.slug, plateNumber: v.plateNumber }));

  const cleanerNameByBikeId: Record<string, string> = {};
  for (const c of contracts) {
    if (!c.terminatedAt && c.riderName) {
      cleanerNameByBikeId[c.bikeId] = c.riderName;
    }
  }

  const reassignVehicles = vehiclesPage.map((v) => ({
    id: v.id ?? v.slug,
    plateNumber: v.plateNumber
  }));

  const plateById: Record<string, string> = Object.fromEntries(
    vehiclesPage.map((v) => [v.id ?? v.slug, v.plateNumber])
  );
  const purposeByBikeId: Record<string, ServiceOpsBikePurpose> = Object.fromEntries(
    vehiclesPage.map((v) => [v.id ?? v.slug, v.purpose ?? "DELIVERY"])
  );

  return (
    (
      <OperationsClient
        offeredCalls={offeredCalls}
        deliveryVehicles={deliveryVehicles}
        cleaningVehicles={cleaningVehicles}
        cleanerNameByBikeId={cleanerNameByBikeId}
        reassignVehicles={reassignVehicles}
        plateById={plateById}
        purposeByBikeId={purposeByBikeId}
      />
    )
  );
}
