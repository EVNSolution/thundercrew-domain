"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  REGION_FILTER_STORAGE_KEY,
  listCityNames,
  listDistrictNames,
  listSidoNames,
  regionForSelection,
  type RegionCollection,
  type SelectedRegion,
  type StoredRegionSelection
} from "@/lib/regions/region-filter";

/**
 * 관제 헤더의 권역 필터 — 도 → 시 → 구 계단식 선택, 각 단계 "전체".
 *
 * 상위를 바꾸면 하위는 전체로 리셋되고 목록이 다시 만들어진다. 가장
 * 구체적인 비-전체 선택이 필터가 된다 (도=경기·시=수원시·구=전체 →
 * 수원시 전체). 경계 GeoJSON 은 public/regions/ 에서 lazy fetch, 마지막
 * 선택은 localStorage 에 유지 (rAF 콜백에서 복원 — 리포 관용구).
 *
 * "권역 외 N대" 는 부모(FullscreenMapHost)가 계산해 내려준다 — 클릭 해제.
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
  const [sidoName, setSidoName] = useState("");
  const [cityName, setCityName] = useState("");
  const [districtName, setDistrictName] = useState("");
  const [sidoNames, setSidoNames] = useState<string[]>([]);
  const [cityNames, setCityNames] = useState<string[]>([]);
  const [districtNames, setDistrictNames] = useState<string[]>([]);
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

  // 시도 목록 — 최초 1회.
  useEffect(() => {
    let cancelled = false;
    loadData()
      .then(({ sido }) => {
        if (!cancelled) setSidoNames(listSidoNames(sido));
      })
      .catch(() => {
        if (!cancelled) setSidoNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  // 하위 목록 — 상위 선택이 바뀔 때마다 파생.
  useEffect(() => {
    let cancelled = false;
    if (!sidoName) {
      const handle = window.requestAnimationFrame(() => {
        if (cancelled) return;
        setCityNames([]);
        setDistrictNames([]);
      });
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(handle);
      };
    }
    loadData()
      .then(({ sido, sigungu }) => {
        if (cancelled) return;
        setCityNames(listCityNames(sidoName, sido, sigungu));
        setDistrictNames(listDistrictNames(sidoName, cityName || null, sido, sigungu));
      })
      .catch(() => {
        if (!cancelled) {
          setCityNames([]);
          setDistrictNames([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sidoName, cityName, loadData]);

  const persist = (selection: StoredRegionSelection) => {
    try {
      if (selection && (selection.sido || selection.city || selection.district)) {
        window.localStorage.setItem(REGION_FILTER_STORAGE_KEY, JSON.stringify(selection));
      } else {
        window.localStorage.removeItem(REGION_FILTER_STORAGE_KEY);
      }
    } catch {
      /* localStorage 불가 환경은 유지만 포기 */
    }
  };

  /** 선택 3값 → 부모 region 반영 + 저장. */
  const applySelection = useCallback(
    async (nextSido: string, nextCity: string, nextDistrict: string) => {
      if (!nextSido) {
        onRegionChange(null);
        persist(null);
        return;
      }
      const { sido, sigungu } = await loadData();
      const next = regionForSelection(
        { sido: nextSido, city: nextCity, district: nextDistrict },
        sido,
        sigungu
      );
      onRegionChange(next);
      persist({ sido: nextSido, city: nextCity, district: nextDistrict });
    },
    [loadData, onRegionChange]
  );

  // 마지막 선택 복원 — mount 1회, rAF 콜백에서 (StrictMode 내성:
  // ref 는 실제 복원 시점에 세운다).
  useEffect(() => {
    if (restoredRef.current || typeof window === "undefined") return;
    const handle = window.requestAnimationFrame(() => {
      restoredRef.current = true;
      try {
        const raw = window.localStorage.getItem(REGION_FILTER_STORAGE_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw) as StoredRegionSelection;
        if (!stored || typeof stored.sido !== "string") return; // 구버전 형태는 무시
        setSidoName(stored.sido);
        setCityName(stored.city ?? "");
        setDistrictName(stored.district ?? "");
        void applySelection(stored.sido, stored.city ?? "", stored.district ?? "");
      } catch {
        /* 손상된 저장값은 무시 — 필터 없이 시작 */
      }
    });
    return () => window.cancelAnimationFrame(handle);
  }, [applySelection]);

  const clearAll = () => {
    setSidoName("");
    setCityName("");
    setDistrictName("");
    onRegionChange(null);
    persist(null);
  };

  return (
    <div className="region-filter-bar" aria-label="권역 필터">
      <select
        className="region-filter-name"
        value={sidoName}
        onChange={(e) => {
          const next = e.target.value;
          // 상위 변경은 하위를 전체로 리셋한다.
          setSidoName(next);
          setCityName("");
          setDistrictName("");
          void applySelection(next, "", "");
        }}
        aria-label="도 선택"
      >
        <option value="">도 전체</option>
        {sidoNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <select
        className="region-filter-name"
        value={cityName}
        onChange={(e) => {
          const next = e.target.value;
          setCityName(next);
          setDistrictName("");
          void applySelection(sidoName, next, "");
        }}
        disabled={!sidoName || cityNames.length === 0}
        aria-label="시 선택"
      >
        <option value="">시 전체</option>
        {cityNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <select
        className="region-filter-name"
        value={districtName}
        onChange={(e) => {
          const next = e.target.value;
          setDistrictName(next);
          void applySelection(sidoName, cityName, next);
        }}
        disabled={!sidoName || districtNames.length === 0}
        aria-label="구 선택"
      >
        <option value="">구 전체</option>
        {districtNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      {region && outsideCount > 0 ? (
        <button
          type="button"
          className="region-filter-outside"
          onClick={clearAll}
          title="권역 필터를 해제하고 전체를 표시"
        >
          권역 외 {outsideCount}대
        </button>
      ) : null}
    </div>
  );
}
