"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/Badge";
import { MapLabelCard } from "@/components/dashboard/MapLabelCard";
import { MapShell } from "@/components/dashboard/MapShell";
import { MapUtilityStack } from "@/components/dashboard/MapUtilityStack";
import { MapZoneSummaryPanel } from "@/components/dashboard/MapZoneSummaryPanel";
import { RegionPolygon } from "@/components/dashboard/RegionPolygon";
import { RiderMarker, StationMarker } from "@/components/dashboard/MapMarkers";
import {
  applyDashboardMode,
  DEFAULT_DASHBOARD_MODE,
  readDashboardMode,
  subscribeDashboardMode,
} from "@/components/dashboard/dashboard-mode";
import { getRegionZonePath } from "@/lib/dashboard/region-zones";
import type {
  ControlMapData,
  ControlMapRegion,
  ControlMapRider
} from "@/lib/services/dashboard-map-data";

type PanelMode = "region" | "rider";

export function ControlMap({ data }: { data: ControlMapData }) {
  const [panelMode, setPanelMode] = useState<PanelMode | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<ControlMapRegion | null>(null);
  const [selectedRider, setSelectedRider] = useState<ControlMapRider | null>(null);
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
    // Selecting a region jumps to map-zone mode so the polygon and summary
    // panel become visible. Returning via "관제로 돌아가기" or the rider
    // marker click brings the user back to live.
    if (dashboardMode !== "map-zone") {
      applyDashboardMode("map-zone");
    }
  };

  const openRiderPanel = (rider: ControlMapRider) => {
    setSelectedRider(rider);
    setPanelMode("rider");
    if (dashboardMode !== "live") {
      applyDashboardMode("live");
    }
  };

  const sourceLabel = data.source === "service-ops" ? "service-ops" : "mock";

  return (
    <section className="control-map-page" aria-label="지도 기반 전기 이륜차 관제 시스템">
      <MapShell />

      {dashboardMode === "map-zone" && selectedRegion ? (() => {
        const path = getRegionZonePath(selectedRegion.name);
        return path ? <RegionPolygon path={path} /> : null;
      })() : null}

      {dashboardMode === "map-zone" ? (
        <MapZoneSummaryPanel region={selectedRegion} />
      ) : null}

      <MapLabelCard
        data={data}
        selectedRegion={selectedRegion}
        onSelectRegion={openRegionPanel}
      />

      {/* NCP markers for pins with lat/lng. */}
      {data.bikePins
        .filter((pin) => typeof pin.lat === "number" && typeof pin.lng === "number")
        .map((pin) => (
          <RiderMarker
            key={`bike-${pin.key}`}
            lat={pin.lat as number}
            lng={pin.lng as number}
            label={pin.label}
            onSelect={() => (pin.rider ? openRiderPanel(pin.rider) : undefined)}
          />
        ))}
      {data.stationPins
        .filter((pin) => typeof pin.lat === "number" && typeof pin.lng === "number")
        .map((pin) => (
          <StationMarker
            key={`station-${pin.key}`}
            lat={pin.lat as number}
            lng={pin.lng as number}
            label={pin.label}
            onSelect={() =>
              openRegionPanel(
                data.regions.find((region) => region.name === pin.regionName) ?? data.regions[0],
              )
            }
          />
        ))}

      {/* Legacy CSS overlay fallback for pins missing coordinates. */}
      <div className="map-object-layer" aria-label="지도 요소 (좌표 없는 항목 fallback)">
        {data.bikePins
          .filter((pin) => typeof pin.lat !== "number" || typeof pin.lng !== "number")
          .map(({ key, rider, label, left, top }) => (
            <button key={`bike-fallback-${key}`} className="map-object map-object-rider" style={{ left, top }} aria-label={`${label} 라이더 위치`} onClick={() => rider ? openRiderPanel(rider) : undefined} type="button">
              <span className="map-object-dot">R</span>
              <span className="map-object-label">{label}</span>
            </button>
          ))}
        {data.stationPins
          .filter((pin) => typeof pin.lat !== "number" || typeof pin.lng !== "number")
          .map(({ key, label, left, regionName, top }) => (
            <button key={`station-fallback-${key}`} className="map-object map-object-station" style={{ left, top }} aria-label={`${label} 배터리 스테이션 위치`} onClick={() => openRegionPanel(data.regions.find((region) => region.name === regionName) ?? data.regions[0])} type="button">
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
