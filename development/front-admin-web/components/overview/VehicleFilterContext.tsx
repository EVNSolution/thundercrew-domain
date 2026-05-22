"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * 차량 탭과 지도가 공유하는 두 가지 채널:
 *
 * 1. **필터 동기화** — `filteredBikeIds === null` 이면 필터 미적용(전체 핀
 *    노출), Set 이면 그 부분 집합만 마커로. VehiclesPanel 이 publish, Map
 *    Banner 가 consume.
 *
 * 2. **선택 차량 동기화** — `selectedBikeId` 가 있으면 지도가 자동으로 켜지고
 *    그 차량의 위치로 pan. 행 클릭이 modal 모달 대신 지도 위 floating panel
 *    을 띄우는 채널이기도 하다.
 *
 * Provider 는 page 의 client subtree 를 한 번만 감싸는 `OverviewClientShell`
 * 에서 마운트되어 모든 탭 컨텐츠가 같은 인스턴스를 본다.
 */
type FilterContextValue = {
  filteredBikeIds: ReadonlySet<string> | null;
  setFilteredBikeIds: (ids: ReadonlySet<string> | null) => void;
  selectedBikeId: string | null;
  setSelectedBikeId: (id: string | null) => void;
};

const VehicleFilterContext = createContext<FilterContextValue | null>(null);

export function VehicleFilterProvider({ children }: { children: ReactNode }) {
  const [filteredBikeIds, setFilteredRaw] = useState<ReadonlySet<string> | null>(null);
  const [selectedBikeId, setSelectedRaw] = useState<string | null>(null);
  const setFilteredBikeIds = useCallback((ids: ReadonlySet<string> | null) => {
    setFilteredRaw(ids);
  }, []);
  const setSelectedBikeId = useCallback((id: string | null) => {
    setSelectedRaw(id);
  }, []);
  const value = useMemo<FilterContextValue>(
    () => ({ filteredBikeIds, setFilteredBikeIds, selectedBikeId, setSelectedBikeId }),
    [filteredBikeIds, setFilteredBikeIds, selectedBikeId, setSelectedBikeId]
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
      filteredBikeIds: null,
      setFilteredBikeIds: () => {},
      selectedBikeId: null,
      setSelectedBikeId: () => {}
    };
  }
  return ctx;
}
