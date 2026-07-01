"use client";

import { useMemo, useState } from "react";

import type {
  FrontendDashboardBikePin,
  FrontendDashboardStationPin
} from "@/lib/services/service-ops-api";

/**
 * 운영자가 차량 번호 또는 BSS 이름/주소를 빠르게 찾기 위한 검색 박스. 지도
 * 위에 floating 으로 떠 있고, 입력에 따라 client-side 로 현재 폴링된 핀
 * 집합을 substring 매칭으로 필터링한다. 결과 클릭 시 부모(`DashboardCanvas`)
 * 가 해당 핀으로 지도를 팬/줌 + 상세 패널 열기를 처리한다.
 *
 * 의도된 한계:
 * - 백엔드 호출 없음. 폴링으로 들고 있는 핀만 검색 대상 — 화면에 보일 수
 *   있는 모든 차량 / BSS 가 이미 stationPins / bikePins 에 들어 있다.
 * - 라벨이 비어 있는 핀은 자동으로 매칭 후보에서 빠진다. 가령 plateNumber
 *   가 빈 문자열인 경우.
 */

export type MonitoringSearchMatch = {
  type: "bike" | "station";
  id: string;
  label: string;
  sublabel?: string;
  latitude: number;
  longitude: number;
};

const MAX_RESULTS = 8;
// 검색 결과 클릭 시 줌을 이 레벨로 맞춰 핀이 시야 정중앙에 또렷이 들어오게
// 한다. 14~16 범위에서 골랐고, 15 가 동/거리 단위 시점으로 적당.
export const SEARCH_TARGET_ZOOM = 15;

export interface MonitoringSearchProps {
  bikePins: ReadonlyArray<FrontendDashboardBikePin>;
  stationPins: ReadonlyArray<FrontendDashboardStationPin>;
  onSelect: (match: MonitoringSearchMatch) => void;
}

export function MonitoringSearch({ bikePins, stationPins, onSelect }: MonitoringSearchProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const matches = useMemo<MonitoringSearchMatch[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const bikeMatches: MonitoringSearchMatch[] = bikePins
      .filter((pin) => pin.plateNumber && pin.plateNumber.toLowerCase().includes(q))
      .map((pin) => ({
        type: "bike" as const,
        id: pin.bikeId,
        label: pin.plateNumber,
        sublabel: pin.modelName || undefined,
        latitude: pin.latitude,
        longitude: pin.longitude
      }));
    const stationMatches: MonitoringSearchMatch[] = stationPins
      .filter((pin) => {
        const name = pin.name?.toLowerCase() ?? "";
        const address = pin.address?.toLowerCase() ?? "";
        return name.includes(q) || address.includes(q);
      })
      .map((pin) => ({
        type: "station" as const,
        id: pin.stationId,
        label: pin.name,
        sublabel: pin.address || undefined,
        latitude: pin.latitude,
        longitude: pin.longitude
      }));
    return [...bikeMatches, ...stationMatches].slice(0, MAX_RESULTS);
  }, [query, bikePins, stationPins]);

  const handleSelect = (match: MonitoringSearchMatch) => {
    onSelect(match);
    // 선택 직후 입력 초기화해서 다음 검색이 깨끗하게 시작되도록 한다.
    setQuery("");
    setFocused(false);
  };

  // 드롭다운은 (1) input 이 포커스 상태이고 (2) 결과가 있을 때만 노출.
  // 결과 항목의 onMouseDown 은 input 의 onBlur 보다 먼저 실행되므로
  // 클릭이 안전하게 도달한다 (onClick 으로 두면 blur → 드롭다운 사라짐
  // → 클릭 미스 가능성).
  const showDropdown = focused && matches.length > 0;

  return (
    <div className="monitoring-search" role="search">
      <input
        className="monitoring-search-input"
        type="search"
        placeholder="차량 번호 또는 BSS 이름 / 주소"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="지도 검색"
      />
      {showDropdown ? (
        <ul className="monitoring-search-dropdown" role="listbox">
          {matches.map((match) => (
            <li
              key={`${match.type}-${match.id}`}
              className="monitoring-search-item"
              role="option"
              aria-selected="false"
              onMouseDown={(event) => {
                event.preventDefault();
                handleSelect(match);
              }}
            >
              <span
                className={`monitoring-search-item-type monitoring-search-item-type--${match.type}`}
              >
                {match.type === "bike" ? "차량" : "BSS"}
              </span>
              <span className="monitoring-search-item-label">{match.label}</span>
              {match.sublabel ? (
                <span className="monitoring-search-item-sub">{match.sublabel}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
