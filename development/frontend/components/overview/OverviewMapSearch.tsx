"use client";

import { useMemo, useState } from "react";

import type {
  FrontendDashboardBikePin
} from "@/lib/services/service-ops-api";

/**
 * 차량 / 충전소 통합 검색 인풋. 옛 `/monitoring` 의 `MonitoringSearch` 를
 * 모델로 하되, 인라인(토글 행 안) 배치로 바뀐 새 placement 에 맞춰 새 CSS
 * 클래스(`overview-map-search-*`) 를 쓴다.
 *
 * 라이더는 검색에서 별도 카테고리로 두지 않는다 — 차량에 매칭된 라이더는
 * 차량 탭 테이블에서 차량에 귀속돼 표기되므로 그걸로 충분하다. 여기서는
 * 차량(번호) / 충전소(이름·주소) 두 종류만 찾는다.
 */

export type OverviewMapSearchMatch =
  | { kind: "bike"; bikeId: string; latitude: number; longitude: number; label: string; sublabel?: string };

export interface OverviewMapSearchProps {
  bikePins: ReadonlyArray<FrontendDashboardBikePin>;
  onSelect: (match: OverviewMapSearchMatch) => void;
}

const MAX_RESULTS = 8;

export function OverviewMapSearch({
  bikePins,
  onSelect
}: OverviewMapSearchProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const matches = useMemo<OverviewMapSearchMatch[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const bikeMatches: OverviewMapSearchMatch[] = bikePins
      .filter((pin) => pin.plateNumber && pin.plateNumber.toLowerCase().includes(q))
      .map((pin) => ({
        kind: "bike" as const,
        bikeId: pin.bikeId,
        latitude: pin.latitude,
        longitude: pin.longitude,
        label: pin.plateNumber,
        sublabel: pin.modelName || undefined
      }));

    // 운영자의 가장 흔한 task (특정 차량 찾기) 가 위에 노출되도록 bike →
    return bikeMatches.slice(0, MAX_RESULTS);
  }, [query, bikePins]);

  const handleSelect = (match: OverviewMapSearchMatch) => {
    onSelect(match);
    setQuery("");
    setFocused(false);
  };

  const showDropdown = focused && matches.length > 0;

  return (
    <div className="overview-map-search" role="search">
      <input
        className="overview-map-search-input"
        type="search"
        placeholder="차량 번호 / 충전소 검색"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="지도 검색"
      />
      {showDropdown ? (
        <ul className="overview-map-search-dropdown" role="listbox">
          {matches.map((match) => {
            const key = `bike-${match.bikeId}`;
            return (
              <li
                key={key}
                className="overview-map-search-item"
                role="option"
                aria-selected="false"
                // onMouseDown 은 input 의 onBlur 보다 먼저 실행되므로 클릭이
                // 안전하게 도달. onClick 이면 blur → dropdown 사라짐 → miss.
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(match);
                }}
              >
                <span className={`overview-map-search-item-chip overview-map-search-item-chip--${match.kind}`}>
                  {match.kind === "bike" ? "차량" : "충전소"}
                </span>
                <span className="overview-map-search-item-label">{match.label}</span>
                {match.sublabel ? (
                  <span className="overview-map-search-item-sub">{match.sublabel}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
