"use client";

import { useMemo, useState } from "react";
import type {
  ControlMapData,
  ControlMapRegion,
} from "@/lib/services/dashboard-map-data";

interface MapLabelCardProps {
  data: ControlMapData;
  selectedRegion: ControlMapRegion | null;
  onSelectRegion: (region: ControlMapRegion) => void;
}

const DEFAULT_TITLE = "구역 실시간 보기";
const COLLAPSED_PLACEHOLDER = "구역을 선택하세요";

export function MapLabelCard({ data, selectedRegion, onSelectRegion }: MapLabelCardProps) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");

  const filteredRegions = useMemo(() => {
    const q = query.trim();
    if (!q) return data.regions;
    return data.regions.filter((region) => region.name.includes(q));
  }, [data.regions, query]);

  const headerTitle = open ? DEFAULT_TITLE : selectedRegion?.name ?? COLLAPSED_PLACEHOLDER;

  return (
    <aside
      className="rm-map-label-card"
      aria-label="지도 라벨"
      data-state={open ? "open" : "collapsed"}
    >
      <header className="rm-map-label-card-header">
        <div className="rm-map-label-card-headline">
          <p className="rm-map-label-card-kicker">지도 라벨</p>
          <h2 className="rm-map-label-card-title">{headerTitle}</h2>
        </div>
        <button
          type="button"
          className="rm-map-label-card-toggle"
          aria-expanded={open}
          aria-controls="rm-map-label-card-body"
          title={open ? "라벨 카드 접기" : "라벨 카드 펼치기"}
          onClick={() => setOpen((next) => !next)}
        >
          <span aria-hidden="true">{open ? "˄" : "˅"}</span>
          <span className="sr-only">{open ? "접기" : "펼치기"}</span>
        </button>
      </header>

      {open ? (
        <div id="rm-map-label-card-body" className="rm-map-label-card-body">
          {data.notice ? (
            <p className="rm-map-label-card-notice" role="status">{data.notice}</p>
          ) : null}

          <label className="rm-map-label-card-search">
            <span className="rm-map-label-card-search-icon" aria-hidden="true">⌕</span>
            <input
              type="search"
              className="rm-map-label-card-search-input"
              placeholder="구역 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="구역 검색"
            />
          </label>

          <ul className="rm-map-label-card-list" role="listbox" aria-label="구역 목록">
            {filteredRegions.length === 0 ? (
              <li className="rm-map-label-card-empty" role="option" aria-selected={false}>
                일치하는 구역이 없습니다
              </li>
            ) : (
              filteredRegions.map((region) => {
                const isSelected = selectedRegion?.name === region.name;
                return (
                  <li key={region.name}>
                    <button
                      type="button"
                      className={`rm-map-label-card-item${isSelected ? " is-selected" : ""}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => onSelectRegion(region)}
                    >
                      <span
                        className={`rm-map-label-card-item-mark${isSelected ? " is-active" : ""}`}
                        aria-hidden="true"
                      >
                        {isSelected ? "●" : "◎"}
                      </span>
                      <span className="rm-map-label-card-item-name">{region.name}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <p className="rm-map-label-card-hint">↵ 구역 선택</p>
        </div>
      ) : null}
    </aside>
  );
}
