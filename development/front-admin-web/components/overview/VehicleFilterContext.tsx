"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * 차량 탭 필터가 적용되었을 때 지도가 그 부분 집합만 마커로 띄울 수 있도록
 * 두 client 컴포넌트(VehiclesPanel ↔ OverviewMapBanner) 사이의 공유 채널.
 *
 * `filteredBikeIds === null` 은 "필터 미적용 / 차량 탭 외 다른 탭 활성"을
 * 의미 — 지도는 전체 차량 핀을 그대로 노출한다. Set 이면 그 집합에 속한
 * 차량 핀만 노출.
 *
 * Provider 는 page 의 최상단 (`OverviewClientShell`) 에서 한 번만 마운트되어
 * 모든 탭 컨텐츠가 같은 인스턴스를 본다. VehiclesPanel 이 마운트되었을 때만
 * 값을 쓰고, 언마운트 시(탭 전환) cleanup 으로 null 로 되돌려 다른 탭에서
 * 의도치 않은 필터가 살아 있는 사태를 막는다.
 */
type FilterContextValue = {
  filteredBikeIds: ReadonlySet<string> | null;
  setFilteredBikeIds: (ids: ReadonlySet<string> | null) => void;
};

const VehicleFilterContext = createContext<FilterContextValue | null>(null);

export function VehicleFilterProvider({ children }: { children: ReactNode }) {
  const [filteredBikeIds, setRaw] = useState<ReadonlySet<string> | null>(null);
  const setFilteredBikeIds = useCallback((ids: ReadonlySet<string> | null) => {
    setRaw(ids);
  }, []);
  const value = useMemo<FilterContextValue>(
    () => ({ filteredBikeIds, setFilteredBikeIds }),
    [filteredBikeIds, setFilteredBikeIds]
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
    return { filteredBikeIds: null, setFilteredBikeIds: () => {} };
  }
  return ctx;
}
