"use client";

import { useEffect, type ReactNode } from "react";

import { NotificationProvider } from "@/components/layout/NotificationContext";
import { FleetSimulationProvider } from "@/components/overview/FleetSimulationContext";
import { VehicleFilterProvider } from "@/components/overview/VehicleFilterContext";
import { resetSimulationDispatchAction } from "@/app/dispatch/actions";
import { PINS_REFRESH_EVENT } from "@/components/overview/use-polling-bike-pins";

/**
 * 루트 페이지의 클라이언트 전용 Provider 래퍼.
 *
 * NotificationProvider — 최외곽. FleetSimulationProvider 가
 * useNotifications() 를 호출하므로 반드시 그 바깥에 있어야 한다.
 *
 * `imeiMinusOneBikeIds` + `bikeRiderPairs` 는 RSC(page.tsx) 가 SSR 에서
 * 계산한 직렬화 가능한 값이다. JSON boundary 를 넘기 위해 배열로 내려받고
 * FleetSimulationProvider 에 그대로 전달.
 */
export function OverviewClientShell({
  children,
  imeiMinusOneBikeIds,
  bikeRiderPairs
}: {
  children: ReactNode;
  imeiMinusOneBikeIds: string[];
  bikeRiderPairs: [string, string][];
}) {
  // 시뮬 배차 체인 재시작 — 브라우저 로드(mount)당 정확히 1회. RSC 에서
  // 호출하면 revalidatePath / router.refresh 가 일어날 때마다 리셋이 재실행
  // 되어, 방금 완료한 배차를 즉시 ASSIGNED 로 되돌리는 순환이 생긴다.
  useEffect(() => {
    let cancelled = false;
    resetSimulationDispatchAction().finally(() => {
      if (cancelled) return;
      // 리셋된 예정 시각·현재 배차가 SSR 스냅샷보다 새로우므로 핀을 즉시 재조회.
      window.dispatchEvent(new Event(PINS_REFRESH_EVENT));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <NotificationProvider>
      <VehicleFilterProvider>
        <FleetSimulationProvider
          imeiMinusOneBikeIds={imeiMinusOneBikeIds}
          bikeRiderPairs={bikeRiderPairs}
        >
          {children}
        </FleetSimulationProvider>
      </VehicleFilterProvider>
    </NotificationProvider>
  );
}
