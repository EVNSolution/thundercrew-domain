"use client";

import type { ReactNode } from "react";

import { FleetSimulationProvider } from "@/components/overview/FleetSimulationContext";
import { VehicleFilterProvider } from "@/components/overview/VehicleFilterContext";

/**
 * 루트 페이지의 client-state 외각. server-render 된 children (KPI / 지도 /
 * 탭 / 패널들) 을 그대로 받되 그 안의 client 컴포넌트들이 공유해야 할 두
 * 채널을 한 번만 마운트한다:
 *   - VehicleFilterContext: 필터/선택/전체화면 토글
 *   - FleetSimulationContext: 데모 배송 시뮬레이션
 */
export function OverviewClientShell({ children }: { children: ReactNode }) {
  return (
    <VehicleFilterProvider>
      <FleetSimulationProvider>{children}</FleetSimulationProvider>
    </VehicleFilterProvider>
  );
}
