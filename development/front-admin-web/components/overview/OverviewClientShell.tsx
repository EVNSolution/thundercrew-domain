"use client";

import type { ReactNode } from "react";

import { VehicleFilterProvider } from "@/components/overview/VehicleFilterContext";

/**
 * 루트 페이지의 client-state 외각. server-render 된 children (KPI / 지도 /
 * 탭 / 패널들) 을 그대로 받되 그 안의 client 컴포넌트들 (`OverviewMapBanner`,
 * `VehiclesPanel`) 이 공유해야 할 state (`VehicleFilterContext`) 를 한 번만
 * 마운트해 둔다.
 *
 * 이 컴포넌트 자체는 UI 를 그리지 않음 — 순수 provider 래퍼. 다른 page-level
 * client state(예: 향후 floating 상세 패널 활성 차량 id) 가 추가되면 여기에
 * 같이 마운트.
 */
export function OverviewClientShell({ children }: { children: ReactNode }) {
  return <VehicleFilterProvider>{children}</VehicleFilterProvider>;
}
