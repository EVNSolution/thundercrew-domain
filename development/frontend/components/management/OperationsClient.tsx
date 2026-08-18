"use client";

import { useState } from "react";

import { BaeminCallPanel } from "@/components/management/BaeminCallPanel";
import { CleaningDispatchPanel } from "@/components/management/CleaningDispatchPanel";
import { DeliveryExcelButtons } from "@/components/management/DeliveryExcelButtons";
import { DispatchHistoryPanel } from "@/components/management/DispatchHistoryPanel";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { PurposeFilterTabs, type PurposeFilter } from "@/components/overview/PurposeFilterTabs";
import type {
  ServiceOpsBikePurpose,
  ServiceOpsDispatchOrder
} from "@/lib/services/service-ops-api";

/**
 * 업무 관리(배차) 클라이언트 골격 — 지도와 같은 용도 필터(전체/배송/클리닝)
 * 로 섹션을 걸러 보여주고, 배차 이력은 우측 사이드 리스트로 띄운다
 * (구 배차 모니터 표 대체).
 */
export function OperationsClient({
  offeredCalls,
  deliveryVehicles,
  cleaningVehicles,
  cleanerNameByBikeId,
  reassignVehicles,
  plateById,
  purposeByBikeId
}: {
  offeredCalls: ServiceOpsDispatchOrder[];
  deliveryVehicles: { id: string; plateNumber: string }[];
  cleaningVehicles: { id: string; plateNumber: string }[];
  cleanerNameByBikeId: Record<string, string>;
  reassignVehicles: { id: string; plateNumber: string }[];
  plateById: Record<string, string>;
  purposeByBikeId: Record<string, ServiceOpsBikePurpose>;
}) {
  const [purposeFilter, setPurposeFilter] = useState<PurposeFilter>("ALL");
  // 등록·업로드 후 사이드 이력 재조회 트리거.
  const [historyReload, setHistoryReload] = useState(0);
  const bumpHistory = () => setHistoryReload((t) => t + 1);

  const showDelivery = purposeFilter === "ALL" || purposeFilter === "DELIVERY";
  const showCleaning = purposeFilter === "ALL" || purposeFilter === "CLEANING";

  return (
    <div className="management-page operations-page">
      <div className="operations-header">
        <PurposeFilterTabs value={purposeFilter} onChange={setPurposeFilter} />
        <NotificationBell />
      </div>
      {showDelivery ? (
        <section className="management-anchor">
          <BaeminCallPanel
            initialOffered={offeredCalls}
            deliveryVehicles={deliveryVehicles}
            excelSlot={
              <DeliveryExcelButtons
                exportUrl="/api/management/dispatch/export"
                onApplied={bumpHistory}
              />
            }
            onDispatched={bumpHistory}
          />
        </section>
      ) : null}
      {showCleaning ? (
        <section className="management-anchor">
          <CleaningDispatchPanel
            exportUrl="/api/management/dispatch/export"
            cleaningVehicles={cleaningVehicles}
            cleanerNameByBikeId={cleanerNameByBikeId}
            onDispatched={bumpHistory}
          />
        </section>
      ) : null}
      <DispatchHistoryPanel
        purposeFilter={purposeFilter}
        plateById={plateById}
        purposeByBikeId={purposeByBikeId}
        reassignVehicles={reassignVehicles}
        reloadTick={historyReload}
      />
    </div>
  );
}
