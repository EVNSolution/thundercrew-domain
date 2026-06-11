"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * 차량 탭과 지도가 공유하는 선택 차량 채널:
 *
 * **선택 차량 동기화** — `selectedBikeId` 가 있으면 지도가 그 차량 위치로 pan
 * 하고 지도 위 floating panel(차량 상세) 이 열린다. 행 클릭 / 마커 클릭이
 * 같은 채널을 통해 서로를 비춘다.
 *
 * (예전엔 `filteredBikeIds` 로 필터도 공유했지만, 차량 필터를 지도 헤더
 * 필터로 단일화하면서 제거했다 — 지도 필터가 곧 테이블 필터다.)
 *
 * Provider 는 page 의 client subtree 를 한 번만 감싸는 `OverviewClientShell`
 * 에서 마운트되어 모든 탭 컨텐츠가 같은 인스턴스를 본다.
 */
type FilterContextValue = {
  selectedBikeId: string | null;
  setSelectedBikeId: (id: string | null) => void;
};

const VehicleFilterContext = createContext<FilterContextValue | null>(null);

export function VehicleFilterProvider({ children }: { children: ReactNode }) {
  const [selectedBikeId, setSelectedRaw] = useState<string | null>(null);
  const setSelectedBikeId = useCallback((id: string | null) => {
    setSelectedRaw(id);
  }, []);
  const value = useMemo<FilterContextValue>(
    () => ({
      selectedBikeId,
      setSelectedBikeId
    }),
    [selectedBikeId, setSelectedBikeId]
  );
  return <VehicleFilterContext.Provider value={value}>{children}</VehicleFilterContext.Provider>;
}

/**
 * Context 가 없는 환경(테스트, Storybook 등) 에서도 안전하게 호출되도록 noop
 * fallback 을 반환. 실제 page 트리에선 항상 provider 가 위에 있다.
 */
export function useVehicleFilter(): FilterContextValue {
  const ctx = useContext(VehicleFilterContext);
  if (!ctx) {
    return {
      selectedBikeId: null,
      setSelectedBikeId: () => {}
    };
  }
  return ctx;
}
