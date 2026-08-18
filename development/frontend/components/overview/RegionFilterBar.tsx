"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  REGION_FILTER_STORAGE_KEY,
  REGION_UNIT_LABEL,
  featuresForRegion,
  listRegionNames,
  type RegionCollection,
  type RegionUnit,
  type SelectedRegion,
  type StoredRegionSelection
} from "@/lib/regions/region-filter";

/**
 * 관제 헤더의 권역 필터 (4단계) — 단위(광역/도/시/구, 기본 시) + 지역 선택.
 *
 * 경계 GeoJSON 은 public/regions/ 에서 lazy fetch 한다 (첫 선택 시 1회).
 * 마지막 선택은 localStorage 에 유지 — 계정 설정이 아니라 이 브라우저의
 * 모니터링 컨텍스트다. 복원은 mount 후 rAF 콜백에서 수행해
 * react-hooks/set-state-in-effect 를 피한다 (리포 관용구).
 *
 * "권역 외 N대" 카운터는 부모(FullscreenMapHost)가 계산해 내려준다 —
 * 클릭하면 권역 해제.
 */
export function RegionFilterBar({
  region,
  onRegionChange,
  outsideCount
}: {
  region: SelectedRegion | null;
  onRegionChange: (region: SelectedRegion | null) => void;
  /** 현재 용도 필터 기준, 좌표가 있는데 권역 밖인 차량 수. */
  outsideCount: number;
}) {
  const [unit, setUnit] = useState<RegionUnit>("CITY");
  const [names, setNames] = useState<string[]>([]);
  const dataRef = useRef<{ sido: RegionCollection; sigungu: RegionCollection } | null>(null);
  const restoredRef = useRef(false);

  const loadData = useCallback(async () => {
    if (dataRef.current) return dataRef.current;
    const [sido, sigungu] = await Promise.all([
      fetch("/regions/sido.json").then((r) => r.json() as Promise<RegionCollection>),
      fetch("/regions/sigungu.json").then((r) => r.json() as Promise<RegionCollection>)
    ]);
    dataRef.current = { sido, sigungu };
    return dataRef.current;
  }, []);

  // 단위가 바뀌면 그 단위의 지역 이름 목록을 만든다.
  useEffect(() => {
    let cancelled = false;
    loadData()
      .then(({ sido, sigungu }) => {
        if (!cancelled) setNames(listRegionNames(unit, sido, sigungu));
      })
      .catch(() => {
        if (!cancelled) setNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [unit, loadData]);

  // 마지막 선택 복원 — mount 1회, rAF 콜백에서.
  useEffect(() => {
    if (restoredRef.current || typeof window === "undefined") return;
    restoredRef.current = true;
    const handle = window.requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(REGION_FILTER_STORAGE_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw) as StoredRegionSelection;
        if (!stored) return;
        setUnit(stored.unit);
        void loadData().then(({ sido, sigungu }) => {
          const features = featuresForRegion(stored.unit, stored.name, sido, sigungu);
          if (features.length > 0) {
            onRegionChange({ unit: stored.unit, name: stored.name, features });
          }
        });
      } catch {
        /* 손상된 저장값은 무시 — 필터 없이 시작 */
      }
    });
    return () => window.cancelAnimationFrame(handle);
  }, [loadData, onRegionChange]);

  const persist = (selection: StoredRegionSelection) => {
    try {
      if (selection) {
        window.localStorage.setItem(REGION_FILTER_STORAGE_KEY, JSON.stringify(selection));
      } else {
        window.localStorage.removeItem(REGION_FILTER_STORAGE_KEY);
      }
    } catch {
      /* localStorage 불가 환경은 유지만 포기 */
    }
  };

  const handleRegionSelect = async (name: string) => {
    if (!name) {
      onRegionChange(null);
      persist(null);
      return;
    }
    const { sido, sigungu } = await loadData();
    const features = featuresForRegion(unit, name, sido, sigungu);
    if (features.length === 0) return;
    onRegionChange({ unit, name, features });
    persist({ unit, name });
  };

  return (
    <div className="region-filter-bar" aria-label="권역 필터">
      <select
        className="region-filter-unit"
        value={unit}
        onChange={(e) => setUnit(e.target.value as RegionUnit)}
        aria-label="권역 단위"
      >
        {(Object.keys(REGION_UNIT_LABEL) as RegionUnit[]).map((u) => (
          <option key={u} value={u}>
            {REGION_UNIT_LABEL[u]}
          </option>
        ))}
      </select>
      <select
        className="region-filter-name"
        value={region && region.unit === unit ? region.name : ""}
        onChange={(e) => void handleRegionSelect(e.target.value)}
        aria-label="권역 선택"
      >
        <option value="">권역 전체</option>
        {names.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      {region && outsideCount > 0 ? (
        <button
          type="button"
          className="region-filter-outside"
          onClick={() => {
            onRegionChange(null);
            persist(null);
          }}
          title="권역 필터를 해제하고 전체를 표시"
        >
          권역 외 {outsideCount}대
        </button>
      ) : null}
    </div>
  );
}
