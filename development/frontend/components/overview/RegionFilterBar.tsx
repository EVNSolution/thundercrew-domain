"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  REGION_FILTER_STORAGE_KEY,
  emdPathForSido,
  listBasicNames,
  listSidoNames,
  listSubNames,
  regionForSelection,
  resolvableSubs,
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
 * 3단계는 다중 선택(체크박스 팝오버) — 고른 동들의 폴리곤 합집합이 권역이
 * 된다. 상위를 바꾸면 하위는 전체로 리셋된다. 시·도/시·군·구 경계는 번들
 * 2파일, 읍·면·동은 시도별 lazy fetch (/regions/emd/{code}.json). 마지막
 * 선택은 localStorage.
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
  const [subSelected, setSubSelected] = useState<string[]>([]);
  const [sidoNames, setSidoNames] = useState<string[]>([]);
  const [basicNames, setBasicNames] = useState<string[]>([]);
  const [subNames, setSubNames] = useState<string[]>([]);
  const [subOpen, setSubOpen] = useState(false);
  const subWrapRef = useRef<HTMLDivElement | null>(null);
  const subButtonRef = useRef<HTMLButtonElement | null>(null);
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

  // 팝오버 바깥 클릭·ESC 로 닫기.
  useEffect(() => {
    if (!subOpen) return;
    const onDown = (event: MouseEvent) => {
      if (subWrapRef.current && !subWrapRef.current.contains(event.target as Node)) {
        setSubOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSubOpen(false);
      // 팝오버가 DOM 에서 사라지며 포커스가 body 로 떨어지는 것을 막는다 —
      // disclosure 패턴대로 트리거 버튼으로 복귀.
      subButtonRef.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [subOpen]);

  const persist = (selection: StoredRegionSelection) => {
    try {
      if (selection && (selection.sido || selection.basic || selection.subs.length > 0)) {
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
    async (nextSido: string, nextBasic: string, nextSubs: string[]) => {
      const seq = ++applySeqRef.current;
      if (!nextSido) {
        onRegionChange(null);
        persist(null);
        return;
      }
      const { sido, sigungu } = await loadData();
      const selection = { sido: nextSido, basic: nextBasic, subs: nextSubs };
      // 먼저 emd 없이 해석 — 분할시 일반구는 여기서 끝난다 (emd 다운로드 불필요).
      let next = regionForSelection(selection, sido, sigungu, null);
      let effective = resolvableSubs(selection, sido, sigungu, null);
      // sub 가 있는데 하나도 못 풀고 기초로 강등됐다면 읍·면·동일 가능성 —
      // emd 로드 후 재해석. (분할시 일반구가 일부라도 풀렸으면 emd 는 무의미.)
      if (nextSubs.length > 0 && effective.length === 0 && next && next.unit === "CITY") {
        const emd = await loadEmd(nextSido);
        if (seq !== applySeqRef.current) return; // 그 사이 새 선택이 이겼다
        next = regionForSelection(selection, sido, sigungu, emd);
        effective = resolvableSubs(selection, sido, sigungu, emd);
      }
      if (seq !== applySeqRef.current) return;
      // emd 실패 등으로 일부/전부 해석이 안 됐으면 체크·저장값도 실제 필터에
      // 맞춘다 — 화면은 역삼동, 필터는 강남구인 무음 불일치를 막는다.
      if (effective.length < nextSubs.length) setSubSelected(effective);
      onRegionChange(next);
      persist({ sido: nextSido, basic: nextBasic, subs: effective });
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
        const stored = JSON.parse(raw) as
          | (StoredRegionSelection & { sub?: string })
          | null;
        if (!stored || typeof stored.sido !== "string" || typeof stored.basic !== "string") {
          return; // 구버전 저장 형태는 무시
        }
        // 구버전 단일 sub 저장값은 배열로 승격.
        const subs = Array.isArray(stored.subs)
          ? stored.subs.filter((s): s is string => typeof s === "string" && s.length > 0)
          : typeof stored.sub === "string" && stored.sub
            ? [stored.sub]
            : [];
        setSidoName(stored.sido);
        setBasicName(stored.basic);
        setSubSelected(subs);
        void applySelection(stored.sido, stored.basic, subs);
      } catch {
        /* 손상된 저장값은 무시 — 필터 없이 시작 */
      }
    });
    return () => window.cancelAnimationFrame(handle);
  }, [applySelection]);

  const clearAll = () => {
    // 진행 중인 applySelection(emd fetch 대기 등)이 해제 뒤에 끝나며 필터를
    // 되살리지 못하게 시퀀스 토큰을 올려 무효화한다.
    applySeqRef.current++;
    setSidoName("");
    setBasicName("");
    setSubSelected([]);
    setSubOpen(false);
    onRegionChange(null);
    persist(null);
  };

  const toggleSub = (name: string) => {
    const next = subSelected.includes(name)
      ? subSelected.filter((s) => s !== name)
      : [...subSelected, name];
    setSubSelected(next);
    void applySelection(sidoName, basicName, next);
  };

  const subButtonLabel =
    subSelected.length === 0
      ? "읍·면·동 전체"
      : subSelected.length === 1
        ? subSelected[0]
        : `${subSelected[0]} 외 ${subSelected.length - 1}`;

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
          setSubSelected([]);
          setSubOpen(false);
          void applySelection(next, "", []);
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
          setSubSelected([]);
          setSubOpen(false);
          void applySelection(sidoName, next, []);
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
      <div className="region-filter-multi" ref={subWrapRef}>
        <button
          type="button"
          ref={subButtonRef}
          className={`region-filter-name region-filter-multi-button${
            subSelected.length > 0 ? " is-active" : ""
          }`}
          onClick={() => setSubOpen((open) => !open)}
          disabled={!basicName || subNames.length === 0}
          aria-haspopup="true"
          aria-expanded={subOpen}
          aria-label="읍·면·동 선택"
        >
          {subButtonLabel}
        </button>
        {subOpen ? (
          // listbox 흉내 대신 group — 네이티브 체크박스 semantics 를 그대로 쓴다.
          <div className="region-filter-multi-popover" role="group" aria-label="읍·면·동 선택">
            <button
              type="button"
              className="region-filter-multi-clear"
              onClick={() => {
                setSubSelected([]);
                setSubOpen(false);
                void applySelection(sidoName, basicName, []);
              }}
            >
              읍·면·동 전체
            </button>
            <div className="region-filter-multi-list">
              {subNames.map((n) => (
                <label key={n} className="region-filter-multi-option">
                  <input
                    type="checkbox"
                    checked={subSelected.includes(n)}
                    onChange={() => toggleSub(n)}
                  />
                  <span>{n}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>
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
