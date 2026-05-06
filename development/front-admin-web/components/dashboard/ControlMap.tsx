"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MapLabelCard } from "@/components/dashboard/MapLabelCard";
import { MapShell } from "@/components/dashboard/MapShell";
import { MapUtilityStack } from "@/components/dashboard/MapUtilityStack";
import { MapZoneSummaryPanel } from "@/components/dashboard/MapZoneSummaryPanel";
import { RegionPolygon } from "@/components/dashboard/RegionPolygon";
import { RiderDetailPanel } from "@/components/dashboard/RiderDetailPanel";
import { RiderMarker, StationMarker } from "@/components/dashboard/MapMarkers";
import { SidebarRail } from "@/components/dashboard/SidebarRail";
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

export function ControlMap({ data }: { data: ControlMapData }) {
  const [selectedRegion, setSelectedRegion] = useState<ControlMapRegion | null>(null);
  const [selectedRider, setSelectedRider] = useState<ControlMapRider | null>(null);

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

  // Mode controls overlay visibility via CSS. Selection state is preserved
  // across mode changes so returning to "live" reopens the same rider.

  const openRegionPanel = (region: ControlMapRegion) => {
    setSelectedRegion(region);
    if (dashboardMode !== "map-zone") {
      applyDashboardMode("map-zone");
    }
  };

  const openRiderPanel = (rider: ControlMapRider) => {
    setSelectedRider(rider);
    if (dashboardMode !== "live") {
      applyDashboardMode("live");
    }
  };

  return (
    <section className="control-map-page" aria-label="지도 기반 전기 이륜차 관제 시스템">
      <MapShell />
      <SidebarRail />

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

      {dashboardMode === "live" && selectedRider ? (
        <RiderDetailPanel rider={selectedRider} onClose={() => setSelectedRider(null)} />
      ) : null}

      <MapUtilityStack mode={dashboardMode} />
    </section>
  );
}
