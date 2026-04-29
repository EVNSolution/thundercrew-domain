"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { riders, stations, vehicles } from "@/lib/services/mock-data";

type PanelMode = "region" | "rider";
type Region = (typeof regions)[number];
type Rider = (typeof riders)[number];

const regions = [
  { name: "강남/역삼", activeVehicles: 1, activeRiders: 1, stations: 1, batteries: 31 },
  { name: "서초/방배", activeVehicles: 1, activeRiders: 1, stations: 1, batteries: 19 },
  { name: "송파/잠실", activeVehicles: 0, activeRiders: 0, stations: 1, batteries: 4 }
];

const riderPins = [
  { rider: riders[0], vehicle: vehicles[0], left: "34%", top: "42%" },
  { rider: riders[1], vehicle: vehicles[2], left: "58%", top: "54%" },
  { rider: riders[2], vehicle: undefined, left: "72%", top: "36%" }
];

const stationPins = [
  { station: stations[0], region: regions[0], left: "40%", top: "32%" },
  { station: stations[1], region: regions[1], left: "54%", top: "64%" },
  { station: stations[2], region: regions[2], left: "76%", top: "48%" }
];

export function ControlMap() {
  const [panelMode, setPanelMode] = useState<PanelMode | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const selectedVehicle = selectedRider ? vehicles.find((vehicle) => vehicle.riderName === selectedRider.name) : undefined;
  const panelOpen = panelMode !== null;

  const openRegionPanel = (region: Region) => {
    setSelectedRegion(region);
    setPanelMode("region");
  };

  const openRiderPanel = (rider: Rider) => {
    setSelectedRider(rider);
    setPanelMode("rider");
  };

  return (
    <section className="control-map-page" aria-label="지도 기반 전기 이륜차 관제 시스템">
      <div className="map-background" aria-hidden="true">
        <div className="map-gridline" />
      </div>

      <div className="map-search-panel" aria-label="관제 검색">
        <div className="search-block">
          <label htmlFor="region-search">지역 검색</label>
          <input id="region-search" className="input" placeholder="예: 강남, 서초, 송파" />
          <div className="search-choice-list" aria-label="지역 검색 결과">
            {regions.map((region) => (
              <button key={region.name} className={`search-choice-card${selectedRegion?.name === region.name ? " is-selected" : ""}`} type="button" onClick={() => openRegionPanel(region)}>
                <strong>{region.name}</strong>
                <span>운행 {region.activeVehicles}대 · 라이더 {region.activeRiders}명 · 교체 가능 {region.batteries}개</span>
              </button>
            ))}
          </div>
        </div>

        <div className="search-block">
          <label htmlFor="rider-search">라이더 검색</label>
          <input id="rider-search" className="input" placeholder="이름 또는 연락처" />
          <div className="search-choice-list" aria-label="라이더 검색 결과">
            {riders.map((rider) => {
              const vehicle = vehicles.find((item) => item.riderName === rider.name);
              return (
                <button key={rider.slug} className={`search-choice-card${selectedRider?.slug === rider.slug ? " is-selected" : ""}`} type="button" onClick={() => openRiderPanel(rider)}>
                  <strong>{rider.name}</strong>
                  <span>{rider.phone} · {rider.area} · {vehicle?.plateNumber ?? "배정 차량 없음"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="map-object-layer" aria-label="지도 요소">
        {riderPins.map(({ rider, vehicle, left, top }) => (
          <button key={rider.slug} className="map-object map-object-rider" style={{ left, top }} aria-label={`${rider.name} 라이더 위치`} onClick={() => openRiderPanel(rider)} type="button">
            <span className="map-object-dot">R</span>
            <span className="map-object-label">{rider.name}{vehicle ? ` · ${vehicle.plateNumber}` : ""}</span>
          </button>
        ))}
        {stationPins.map(({ station, region, left, top }) => (
          <button key={station.slug} className="map-object map-object-station" style={{ left, top }} aria-label={`${station.name} 배터리 스테이션 위치`} onClick={() => openRegionPanel(region)} type="button">
            <span className="map-object-dot">B</span>
            <span className="map-object-label">{station.name} · {station.replaceableCount}개</span>
          </button>
        ))}
      </div>

      {panelOpen ? (
        <aside className="map-info-panel" aria-label="관제 정보 패널">
          <button className="map-panel-close" type="button" aria-label="정보 패널 닫기" onClick={() => setPanelMode(null)}>×</button>
          <div className="map-info-header">
            <div>
              <p className="hero-kicker">{panelMode === "region" ? "Region Summary" : "Rider Detail"}</p>
              <h1>{panelMode === "region" ? `${selectedRegion?.name ?? "선택 지역"} 관제 요약` : `${selectedRider?.name ?? "선택 라이더"} 정보`}</h1>
            </div>
            <Badge tone="active">실시간 mock</Badge>
          </div>

          {panelMode === "region" && selectedRegion ? (
            <>
              <div className="map-info-section">
                <h2>지역별 요약</h2>
                <div className="map-summary-grid">
                  <div><span>운행 차량</span><strong>{selectedRegion.activeVehicles}</strong></div>
                  <div><span>활동 라이더</span><strong>{selectedRegion.activeRiders}</strong></div>
                  <div><span>스테이션</span><strong>{selectedRegion.stations}</strong></div>
                  <div><span>교체 가능</span><strong>{selectedRegion.batteries}</strong></div>
                </div>
              </div>
              <div className="map-info-section">
                <h2>지역 내 지도 요소</h2>
                <p>배터리 스테이션, 운행 라이더, 교체 가능 배터리 수량을 지역 기준으로 요약합니다. 실제 지도 API 연결 전까지 mock 위치 컴포넌트로 표시합니다.</p>
              </div>
            </>
          ) : null}

          {panelMode === "rider" && selectedRider ? (
            <>
              <div className="map-info-section">
                <h2>라이더 정보</h2>
                <div className="detail-list">
                  <div className="detail-row"><span>이름</span><strong>{selectedRider.name}</strong></div>
                  <div className="detail-row"><span>연락처</span><strong>{selectedRider.phone}</strong></div>
                  <div className="detail-row"><span>담당 구역</span><strong>{selectedRider.area}</strong></div>
                  <div className="detail-row"><span>배정 차량</span><strong>{selectedVehicle?.plateNumber ?? "없음"}</strong></div>
                  <div className="detail-row"><span>차량 상태</span><strong>{selectedVehicle?.status ?? "대기"}</strong></div>
                </div>
              </div>
              <div className="form-actions">
                <Link className="button-secondary" href={`/riders/${selectedRider.slug}`}>라이더 상세로 이동</Link>
              </div>
            </>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}
