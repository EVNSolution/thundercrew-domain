"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  REGION_FILTER_STORAGE_KEY,
  emdPathForSido,
  listBasicNames,
  listSidoNames,
  listSubNames,
  regionForSelection,
  type RegionCollection,
  type SelectedRegion,
  type StoredRegionSelection
} from "@/lib/regions/region-filter";

/**
 * 관제 헤더의 권역 필터 — 행정구역 3단계 계단식 선택, 각 단계 "전체".
 *
 *   시·도(17) → 시·군·구(기초자치단체 — 광역시 자치구 포함) → 읍·면·동
 *   (분할 대도시는 3단계가 일반구: 수원시 → 장안·권선·팔달·영통구)
 *
 * 상위를 바꾸면 하위는 전체로 리셋된다. 가장 구체적인 비-전체 선택이
 * 필터가 된다. 시·도/시·군·구 경계는 번들 2파일, 읍·면·동은 시도별
 * lazy fetch (/regions/emd/{code}.json). 마지막 선택은 localStorage.
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
  const [basicName, setBasicName] = useState("");
  const [subName, setSubName] = useState("");
  const [sidoNames, setSidoNames] = useState<string[]>([]);
  const [basicNames, setBasicNames] = useState<string[]>([]);
  const [subNames, setSubNames] = useState<string[]>([]);
  const dataRef = useRef<{ sido: RegionCollection; sigungu: RegionCollection } | null>(null);
  // 진행 중 promise 를 캐시해 같은 시도 파일(최대 ~370KB)의 병렬 중복
  // 다운로드를 막는다 (복원 시 목록 effect 와 applySelection 이 동시 발화).
  const emdCacheRef = useRef<Map<string, Promise<RegionCollection | null>>>(new Map());
  const restoredRef = useRef(false);
  // 늦게 도착한 이전 선택의 반영을 막는 시퀀스 토큰.
  const applySeqRef = useRef(0);

  const loadData = useCallback(async () => {
    if (dataRef.current) return dataRef.current;
    const [sido, sigungu] = await Promise.all([
      fetch("/regions/sido.json").then((r) => r.json() as Promise<RegionCollection>),
      fetch("/regions/sigungu.json").then((r) => r.json() as Promise<RegionCollection>)
    ]);
    dataRef.current = { sido, sigungu };
    return dataRef.current;
  }, []);

  /** 읍·면·동 컬렉션 — 시도별 파일을 promise 캐시로 lazy fetch (중복 방지). */
  const loadEmd = useCallback(
    async (forSido: string): Promise<RegionCollection | null> => {
      const { sido } = await loadData();
      const path = emdPathForSido(forSido, sido);
      if (!path) return null;
      const cached = emdCacheRef.current.get(path);
      if (cached) return cached;
      const promise = fetch(path)
        .then((r) => r.json() as Promise<RegionCollection>)
        .catch(() => {
          // 실패한 promise 를 캐시에 남기면 재시도가 영영 안 된다.
          emdCacheRef.current.delete(path);
          return null;
        });
      emdCacheRef.current.set(path, promise);
      return promise;
    },
    [loadData]
  );

  // 시·도 목록 — 최초 1회.
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

  // 하위 목록 — 상위 선택이 바뀔 때마다 파생. 3단계는 emd 가 필요할 수
  // 있어(단일 기초) lazy fetch 를 함께 건다.
  useEffect(() => {
    let cancelled = false;
    if (!sidoName) {
      const handle = window.requestAnimationFrame(() => {
        if (cancelled) return;
        setBasicNames([]);
        setSubNames([]);
      });
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(handle);
      };
    }
    void (async () => {
      try {
        const { sido, sigungu } = await loadData();
        if (cancelled) return;
        setBasicNames(listBasicNames(sidoName, sido, sigungu));
        if (!basicName) {
          setSubNames([]);
          return;
        }
        // 분할시는 emd 없이도 일반구 목록이 나온다 — 먼저 시도해 보고,
        // 비어 있으면 읍·면·동 파일을 로드해 다시 만든다.
        const withoutEmd = listSubNames(sidoName, basicName, sido, sigungu, null);
        if (withoutEmd.length > 0) {
          setSubNames(withoutEmd);
          return;
        }
        const emd = await loadEmd(sidoName);
        if (cancelled) return;
        setSubNames(listSubNames(sidoName, basicName, sido, sigungu, emd));
      } catch {
        if (!cancelled) {
          setBasicNames([]);
          setSubNames([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sidoName, basicName, loadData, loadEmd]);

  const persist = (selection: StoredRegionSelection) => {
    try {
      if (selection && (selection.sido || selection.basic || selection.sub)) {
        window.localStorage.setItem(REGION_FILTER_STORAGE_KEY, JSON.stringify(selection));
      } else {
        window.localStorage.removeItem(REGION_FILTER_STORAGE_KEY);
      }
    } catch {
      /* localStorage 불가 환경은 유지만 포기 */
    }
  };

  /** 선택 3값 → 부모 region 반영 + 저장. 늦게 끝난 이전 호출은 무시. */
  const applySelection = useCallback(
    async (nextSido: string, nextBasic: string, nextSub: string) => {
      const seq = ++applySeqRef.current;
      if (!nextSido) {
        onRegionChange(null);
        persist(null);
        return;
      }
      const { sido, sigungu } = await loadData();
      // 먼저 emd 없이 해석 — 분할시 일반구는 여기서 끝난다 (emd 다운로드 불필요).
      let next = regionForSelection(
        { sido: nextSido, basic: nextBasic, sub: nextSub },
        sido,
        sigungu,
        null
      );
      // sub 가 있는데 기초 단위로 강등됐다면 읍·면·동일 가능성 — emd 로드 후 재해석.
      if (nextSub && next && next.unit === "CITY") {
        const emd = await loadEmd(nextSido);
        if (seq !== applySeqRef.current) return; // 그 사이 새 선택이 이겼다
        next = regionForSelection(
          { sido: nextSido, basic: nextBasic, sub: nextSub },
          sido,
          sigungu,
          emd
        );
      }
      if (seq !== applySeqRef.current) return;
      // emd 실패 등으로 sub 해석이 끝내 강등됐으면 select·저장값도 기초로
      // 맞춘다 — 화면은 역삼동, 필터는 강남구인 무음 불일치를 막는다.
      const effectiveSub = nextSub && next && next.unit !== "CITY" ? nextSub : "";
      if (nextSub && !effectiveSub) setSubName("");
      onRegionChange(next);
      persist({ sido: nextSido, basic: nextBasic, sub: effectiveSub });
    },
    [loadData, loadEmd, onRegionChange]
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
        if (!stored || typeof stored.sido !== "string" || typeof stored.basic !== "string") {
          return; // 구버전 저장 형태는 무시
        }
        setSidoName(stored.sido);
        setBasicName(stored.basic);
        setSubName(stored.sub ?? "");
        void applySelection(stored.sido, stored.basic, stored.sub ?? "");
      } catch {
        /* 손상된 저장값은 무시 — 필터 없이 시작 */
      }
    });
    return () => window.cancelAnimationFrame(handle);
  }, [applySelection]);

  const clearAll = () => {
    setSidoName("");
    setBasicName("");
    setSubName("");
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
          setBasicName("");
          setSubName("");
          void applySelection(next, "", "");
        }}
        aria-label="시·도 선택"
      >
        <option value="">시·도 전체</option>
        {sidoNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <select
        className="region-filter-name"
        value={basicName}
        onChange={(e) => {
          const next = e.target.value;
          setBasicName(next);
          setSubName("");
          void applySelection(sidoName, next, "");
        }}
        disabled={!sidoName || basicNames.length === 0}
        aria-label="시·군·구 선택"
      >
        <option value="">시·군·구 전체</option>
        {basicNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <select
        className="region-filter-name"
        value={subName}
        onChange={(e) => {
          const next = e.target.value;
          setSubName(next);
          void applySelection(sidoName, basicName, next);
        }}
        disabled={!basicName || subNames.length === 0}
        aria-label="읍·면·동 선택"
      >
        <option value="">읍·면·동 전체</option>
        {subNames.map((n) => (
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
