"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/Badge";
import { MapShell } from "@/components/dashboard/MapShell";
import { MapUtilityStack } from "@/components/dashboard/MapUtilityStack";
import {
  applyDashboardMode,
  DEFAULT_DASHBOARD_MODE,
  readDashboardMode,
  subscribeDashboardMode,
} from "@/components/dashboard/dashboard-mode";
import type {
  ControlMapData,
  ControlMapRegion,
  ControlMapRider
} from "@/lib/services/dashboard-map-data";

type PanelMode = "region" | "rider";
type SearchTab = "region" | "rider";

export function ControlMap({ data }: { data: ControlMapData }) {
  const [panelMode, setPanelMode] = useState<PanelMode | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<ControlMapRegion | null>(null);
  const [selectedRider, setSelectedRider] = useState<ControlMapRider | null>(null);
  const [searchOpen, setSearchOpen] = useState(true);
  const [searchTab, setSearchTab] = useState<SearchTab>("region");
  const panelOpen = panelMode !== null;

  const dashboardMode = useSyncExternalStore(
    subscribeDashboardMode,
    readDashboardMode,
    () => DEFAULT_DASHBOARD_MODE,
  );

  useEffect(() => {
    document.documentElement.dataset.dashboardMode = dashboardMode;
    return () => {
      delete document.documentElement.dataset.dashboardMode;
    };
  }, [dashboardMode]);

  // Mode controls overlay visibility via CSS. The detail panel state itself
  // is preserved across mode changes so returning to "live" reopens the same
  // selection without an extra click.

  const openRegionPanel = (region: ControlMapRegion) => {
    setSelectedRegion(region);
    setPanelMode("region");
    if (dashboardMode === "panel-closed" || dashboardMode === "fullscreen") {
      applyDashboardMode("live");
    }
  };

  const openRiderPanel = (rider: ControlMapRider) => {
    setSelectedRider(rider);
    setPanelMode("rider");
    if (dashboardMode === "panel-closed" || dashboardMode === "fullscreen") {
      applyDashboardMode("live");
    }
  };

  const sourceLabel = data.source === "service-ops" ? "service-ops" : "mock";

  return (
    <section className="control-map-page" aria-label="지도 기반 전기 이륜차 관제 시스템">
      <MapShell />

      <div className={`map-search-panel map-search-panel-top${searchOpen ? "" : " is-collapsed"}`} aria-label="관제 검색">
        <div className="map-search-header">
          <strong>{searchTab === "region" ? "지역 검색" : "라이더 검색"}</strong>
          <button className="button-secondary" type="button" onClick={() => setSearchOpen((open) => !open)} aria-expanded={searchOpen}>{searchOpen ? "검색 접기" : "검색 펼치기"}</button>
        </div>

        {searchOpen ? (
          <div className="map-search-body">
            {data.notice ? <p className="notice">{data.notice}</p> : null}
            <div className="search-tabs" role="tablist" aria-label="검색 대상 선택">
              <button className={searchTab === "region" ? "is-active" : ""} type="button" role="tab" aria-selected={searchTab === "region"} onClick={() => setSearchTab("region")}>지역</button>
              <button className={searchTab === "rider" ? "is-active" : ""} type="button" role="tab" aria-selected={searchTab === "rider"} onClick={() => setSearchTab("rider")}>라이더</button>
            </div>
            <input className="input" placeholder={searchTab === "region" ? "지역명 검색 예: 강남, 서초, 송파" : "라이더 이름 또는 연락처 검색"} />
            <div className="search-choice-list" aria-label={searchTab === "region" ? "지역 검색 결과" : "라이더 검색 결과"}>
              {searchTab === "region" ? data.regions.map((region) => (
                <button key={region.name} className={`search-choice-card${selectedRegion?.name === region.name ? " is-selected" : ""}`} type="button" onClick={() => openRegionPanel(region)}>
                  <strong>{region.name}</strong>
                  <span>운행 {region.activeVehicles}대 · 라이더 {region.activeRiders}명 · 교체 가능 {region.batteries}개</span>
                </button>
              )) : data.riders.map((rider) => {
                return (
                  <button key={rider.slug} className={`search-choice-card${selectedRider?.slug === rider.slug ? " is-selected" : ""}`} type="button" onClick={() => openRiderPanel(rider)}>
                    <strong>{rider.name}</strong>
                    <span>{rider.phone} · {rider.area} · {rider.vehiclePlateNumber ?? "배정 차량 없음"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="map-object-layer" aria-label="지도 요소">
        {data.bikePins.map(({ key, rider, label, left, top }) => (
          <button key={key} className="map-object map-object-rider" style={{ left, top }} aria-label={`${label} 라이더 위치`} onClick={() => rider ? openRiderPanel(rider) : undefined} type="button">
            <span className="map-object-dot">R</span>
            <span className="map-object-label">{label}</span>
          </button>
        ))}
        {data.stationPins.map(({ key, label, left, regionName, top }) => (
          <button key={key} className="map-object map-object-station" style={{ left, top }} aria-label={`${label} 배터리 스테이션 위치`} onClick={() => openRegionPanel(data.regions.find((region) => region.name === regionName) ?? data.regions[0])} type="button">
            <span className="map-object-dot">B</span>
            <span className="map-object-label">{label}</span>
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
            <Badge tone="active">{sourceLabel}</Badge>
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
                <p>배터리 스테이션, 운행 라이더, 교체 가능 배터리 수량을 지도 관제 기준으로 요약합니다. 실제 지도 SDK 연결 전까지 좌표 기반 위치 컴포넌트로 표시합니다.</p>
                {data.generatedAt ? <p>생성 시각: {data.generatedAt}</p> : null}
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
                  <div className="detail-row"><span>배정 차량</span><strong>{selectedRider.vehiclePlateNumber ?? "없음"}</strong></div>
                  <div className="detail-row"><span>차량 상태</span><strong>{selectedRider.vehicleStatus ?? "대기"}</strong></div>
                  <div className="detail-row"><span>연결 상태</span><strong>{selectedRider.connectionStatus ?? "mock"}</strong></div>
                </div>
              </div>
              {selectedRider.detailHref ? (
                <div className="form-actions">
                  <Link className="button-secondary" href={selectedRider.detailHref}>라이더 상세로 이동</Link>
                </div>
              ) : (
                <p className="notice">map-state 응답은 라이더 전화번호/ID를 노출하지 않습니다. 라이더 상세 연결은 라이더 API selector 연동 범위에서 처리합니다.</p>
              )}
            </>
          ) : null}
        </aside>
      ) : null}

      <MapUtilityStack mode={dashboardMode} />
    </section>
  );
}
