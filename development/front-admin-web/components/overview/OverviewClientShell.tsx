"use client";

import type { ReactNode } from "react";

import { NotificationProvider } from "@/components/layout/NotificationContext";
import { FleetSimulationProvider } from "@/components/overview/FleetSimulationContext";
import { VehicleFilterProvider } from "@/components/overview/VehicleFilterContext";

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
