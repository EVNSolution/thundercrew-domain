"use client";

import { useMemo, useState } from "react";

import type {
  FrontendDashboardBikePin,
  FrontendDashboardStationPin
} from "@/lib/services/service-ops-api";

/**
 * 차량 / BSS / 라이더 통합 검색 인풋. 옛 `/monitoring` 의 `MonitoringSearch` 를
 * 모델로 하되 결과 종류를 셋으로 늘리고, 인라인(토글 행 안) 배치로 바뀐 새
 * placement 에 맞춰 새 CSS 클래스(`overview-map-search-*`) 를 쓴다.
 *
 * 라이더 항목은 지도 위에 마커가 없으므로, 라이더가 현재 타고 있는 bike 의
 * 좌표를 사용해 같은 "지도 팬 + 차량 상세 패널 열기" 흐름으로 연결한다.
 */

export type OverviewMapSearchMatch =
  | { kind: "bike"; bikeId: string; latitude: number; longitude: number; label: string; sublabel?: string }
  | { kind: "station"; latitude: number; longitude: number; label: string; sublabel?: string }
  | { kind: "rider"; bikeId: string; latitude: number; longitude: number; label: string; sublabel?: string };

export interface OverviewMapSearchProps {
  bikePins: ReadonlyArray<FrontendDashboardBikePin>;
  stationPins: ReadonlyArray<FrontendDashboardStationPin>;
  /** bike → rider 인덱스. 라이더 검색 후보를 "할당된 라이더" 로 좁히고
   *  결과 클릭 시 그 라이더가 타는 bike 의 좌표로 점프하는 데 쓴다. */
  bikeActiveRiderById?: Map<string, string>;
  /** rider id → { name, phone } */
  riderInfoById?: Map<string, { name: string; phone: string }>;
  onSelect: (match: OverviewMapSearchMatch) => void;
}

const MAX_RESULTS = 8;

export function OverviewMapSearch({
  bikePins,
  stationPins,
  bikeActiveRiderById,
  riderInfoById,
  onSelect
}: OverviewMapSearchProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  // rider → bike 역방향 인덱스. 라이더 매칭이 잡힌 결과를 한 번에 좌표로
  // 매핑하기 위해 매 키스트로크가 아니라 deps 변경 시에만 다시 만든다.
  const bikeIdByRiderId = useMemo(() => {
    const map = new Map<string, string>();
    if (!bikeActiveRiderById) return map;
    for (const [bikeId, riderId] of bikeActiveRiderById) {
      map.set(riderId, bikeId);
    }
    return map;
  }, [bikeActiveRiderById]);

  // bikeId → pin 빠른 lookup. 라이더 매칭 결과에서 좌표를 채울 때 사용.
  const bikePinById = useMemo(() => {
    const map = new Map<string, FrontendDashboardBikePin>();
    for (const pin of bikePins) map.set(pin.bikeId, pin);
    return map;
  }, [bikePins]);

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

    const riderMatches: OverviewMapSearchMatch[] = [];
    if (riderInfoById) {
      for (const [riderId, info] of riderInfoById) {
        const bikeId = bikeIdByRiderId.get(riderId);
        if (!bikeId) continue; // 할당된 차량이 없으면 화면에 표시할 의미가 없다
        const pin = bikePinById.get(bikeId);
        if (!pin) continue; // 차량이 핀에 없으면 (예: 폴링 누락) 스킵
        const name = info.name?.toLowerCase() ?? "";
        const phone = info.phone?.toLowerCase() ?? "";
        if (!name.includes(q) && !phone.includes(q)) continue;
        riderMatches.push({
          kind: "rider",
          bikeId,
          latitude: pin.latitude,
          longitude: pin.longitude,
          label: info.name,
          sublabel: `${info.phone} · ${pin.plateNumber}`
        });
      }
    }

    const stationMatches: OverviewMapSearchMatch[] = stationPins
      .filter((pin) => {
        const name = pin.name?.toLowerCase() ?? "";
        const address = pin.address?.toLowerCase() ?? "";
        return name.includes(q) || address.includes(q);
      })
      .map((pin) => ({
        kind: "station" as const,
        latitude: pin.latitude,
        longitude: pin.longitude,
        label: pin.name,
        sublabel: pin.address || undefined
      }));

    // 운영자의 가장 흔한 task (특정 차량 찾기) 가 위에 노출되도록 bike → rider
    // → station 순서로 채워서 8개에서 절단. 스펙의 "고정 순서" 결정 그대로.
    return [...bikeMatches, ...riderMatches, ...stationMatches].slice(0, MAX_RESULTS);
  }, [query, bikePins, stationPins, riderInfoById, bikeIdByRiderId, bikePinById]);

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
        placeholder="차량 번호 / BSS / 라이더 검색"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="지도 검색"
      />
      {showDropdown ? (
        <ul className="overview-map-search-dropdown" role="listbox">
          {matches.map((match) => {
            const key =
              match.kind === "station"
                ? `station-${match.label}-${match.latitude}-${match.longitude}`
                : `${match.kind}-${match.bikeId}`;
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
                  {match.kind === "bike" ? "차량" : match.kind === "station" ? "BSS" : "라이더"}
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
