import {
  type FrontendDashboardMapState,
  type FrontendDashboardBikePin,
  type FrontendDashboardStationPin,
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import { riders, stations, vehicles } from "@/lib/services/mock-data";

export type ControlMapSource = "mock" | "service-ops";

export type ControlMapRegion = {
  name: string;
  activeVehicles: number;
  activeRiders: number;
  stations: number;
  batteries: number;
};

export type ControlMapRider = {
  slug: string;
  name: string;
  phone: string;
  area: string;
  team?: string;
  status: "활동" | "대기" | "휴면";
  vehiclePlateNumber?: string;
  vehicleStatus?: string;
  vehicleBatteryPercent?: number | null;
  connectionStatus?: string;
  detailHref?: string;
};

export type ControlMapBikePin = {
  key: string;
  label: string;
  left: string;
  top: string;
  /** WGS84 latitude. Optional so the legacy mock layer keeps rendering. */
  lat?: number;
  /** WGS84 longitude. */
  lng?: number;
  plateNumber: string;
  rider?: ControlMapRider;
};

export type ControlMapStationPin = {
  key: string;
  label: string;
  left: string;
  top: string;
  lat?: number;
  lng?: number;
  regionName: string;
};

export type ControlMapData = {
  source: ControlMapSource;
  generatedAt?: string;
  notice?: string;
  regions: ControlMapRegion[];
  riders: ControlMapRider[];
  bikePins: ControlMapBikePin[];
  stationPins: ControlMapStationPin[];
};

type ProjectedPosition = {
  left: string;
  top: string;
};

export async function loadDashboardMapData(): Promise<ControlMapData> {
  const fallback = mockDashboardMapData();

  if (!serviceOpsApiConfigured()) {
    return {
      ...fallback,
      notice: "SERVICE_OPS_API_BASE_URL이 없어 mock 지도 관제 데이터를 표시합니다. 백엔드 연결 시 map-state API로 전환됩니다."
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      ...fallback,
      notice: "서비스 API 세션 쿠키가 없어 mock 지도 관제 데이터를 표시합니다. 관리자 로그인 후 실제 map-state로 전환됩니다."
    };
  }

  try {
    return serviceOpsDashboardMapData(await client.getDashboardMapState());
  } catch (error) {
    return {
      ...fallback,
      notice: `서비스 API map-state 조회 실패로 mock 지도 관제 데이터를 표시합니다.${formatServiceOpsError(error)}`
    };
  }
}

export function mockDashboardMapData(): ControlMapData {
  const regions: ControlMapRegion[] = [
    { name: "강남/역삼", activeVehicles: 1, activeRiders: 1, stations: 1, batteries: 31 },
    { name: "서초/방배", activeVehicles: 1, activeRiders: 1, stations: 1, batteries: 19 },
    { name: "송파/잠실", activeVehicles: 0, activeRiders: 0, stations: 1, batteries: 4 }
  ];

  const mapRiders: ControlMapRider[] = riders.map((rider) => {
    const vehicle = vehicles.find((item) => item.riderName === rider.name);
    return {
      area: rider.area,
      detailHref: `/riders/${rider.slug}`,
      name: rider.name,
      phone: rider.phone,
      slug: rider.slug,
      status: rider.status,
      team: rider.team,
      vehicleBatteryPercent: vehicle?.batteryPercent,
      vehiclePlateNumber: vehicle?.plateNumber,
      vehicleStatus: vehicle?.status
    };
  });

  return {
    bikePins: [
      toMockBikePin(mapRiders[0], "34%", "42%", 37.5005, 127.0376),
      toMockBikePin(mapRiders[1], "58%", "54%", 37.4837, 127.0327),
      toMockBikePin(mapRiders[2], "72%", "36%", 37.5145, 127.1059)
    ],
    regions,
    riders: mapRiders,
    source: "mock",
    stationPins: [
      toMockStationPin(stations[0], regions[0], "40%", "32%", 37.5025, 127.0405),
      toMockStationPin(stations[1], regions[1], "54%", "64%", 37.4855, 127.0301),
      toMockStationPin(stations[2], regions[2], "76%", "48%", 37.5172, 127.1025)
    ]
  };
}

export function serviceOpsDashboardMapData(mapState: FrontendDashboardMapState): ControlMapData {
  const allPoints = [
    ...mapState.bikePins.map((pin) => ({ key: `bike-${pin.slug}`, latitude: pin.latitude, longitude: pin.longitude })),
    ...mapState.stationPins.map((pin) => ({ key: `station-${pin.slug}`, latitude: pin.latitude, longitude: pin.longitude }))
  ];
  const positions = projectPositions(allPoints);
  const riderByLabel = new Map<string, ControlMapRider>();

  mapState.bikePins.forEach((pin) => {
    if (!pin.activeRiderLabel || riderByLabel.has(pin.activeRiderLabel)) {
      return;
    }

    riderByLabel.set(pin.activeRiderLabel, toServiceOpsRider(pin));
  });

  const ridersFromPins = Array.from(riderByLabel.values());

  return {
    bikePins: mapState.bikePins.map((pin, index) => ({
      key: pin.slug,
      label: pin.pinLabel,
      lat: Number.isFinite(pin.latitude) ? pin.latitude : undefined,
      left: positions.get(`bike-${pin.slug}`)?.left ?? fallbackLeft(index),
      lng: Number.isFinite(pin.longitude) ? pin.longitude : undefined,
      plateNumber: pin.plateNumber,
      rider: pin.activeRiderLabel ? riderByLabel.get(pin.activeRiderLabel) : undefined,
      top: positions.get(`bike-${pin.slug}`)?.top ?? fallbackTop(index)
    })),
    generatedAt: mapState.generatedAt,
    regions: [
      {
        activeRiders: riderByLabel.size,
        activeVehicles: mapState.summary.onlineBikeCount,
        batteries: mapState.summary.availableBatteryCount,
        name: "전체 관제",
        stations: mapState.summary.stationPinCount
      }
    ],
    riders: ridersFromPins,
    source: "service-ops",
    stationPins: mapState.stationPins.map((pin, index) => ({
      key: pin.slug,
      label: pin.pinLabel,
      lat: Number.isFinite(pin.latitude) ? pin.latitude : undefined,
      left: positions.get(`station-${pin.slug}`)?.left ?? fallbackLeft(index + mapState.bikePins.length),
      lng: Number.isFinite(pin.longitude) ? pin.longitude : undefined,
      regionName: "전체 관제",
      top: positions.get(`station-${pin.slug}`)?.top ?? fallbackTop(index + mapState.bikePins.length)
    }))
  };
}

function toMockBikePin(rider: ControlMapRider, left: string, top: string, lat: number, lng: number): ControlMapBikePin {
  return {
    key: rider.slug,
    label: `${rider.name}${rider.vehiclePlateNumber ? ` · ${rider.vehiclePlateNumber}` : ""}`,
    lat,
    left,
    lng,
    plateNumber: rider.vehiclePlateNumber ?? "배정 차량 없음",
    rider,
    top
  };
}

function toMockStationPin(
  station: (typeof stations)[number],
  region: ControlMapRegion,
  left: string,
  top: string,
  lat: number,
  lng: number
): ControlMapStationPin {
  return {
    key: station.slug,
    label: `${station.name} ${station.replaceableCount}/${station.batteryCount}`,
    lat,
    left,
    lng,
    regionName: region.name,
    top
  };
}

function toServiceOpsRider(pin: FrontendDashboardBikePin): ControlMapRider {
  return {
    area: "전체 관제",
    connectionStatus: pin.connectionStatus,
    name: pin.activeRiderLabel ?? "미지정 라이더",
    phone: "map-state 미제공",
    slug: `map-rider-${pin.bikeId}`,
    status: pin.connectionStatus === "ONLINE" ? "활동" : "대기",
    vehicleBatteryPercent: pin.batteryPercent,
    vehiclePlateNumber: pin.plateNumber,
    vehicleStatus: pin.drivingStatus
  };
}

function projectPositions(points: Array<{ key: string; latitude: number; longitude: number }>): Map<string, ProjectedPosition> {
  const finitePoints = points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  const latitudes = finitePoints.map((point) => point.latitude);
  const longitudes = finitePoints.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;
  const projected = new Map<string, ProjectedPosition>();

  finitePoints.forEach((point, index) => {
    const normalizedLng = lngRange === 0 ? 0.5 : (point.longitude - minLng) / lngRange;
    const normalizedLat = latRange === 0 ? 0.5 : (point.latitude - minLat) / latRange;
    projected.set(point.key, {
      left: `${Math.round(20 + normalizedLng * 60)}%`,
      top: `${Math.round(25 + (1 - normalizedLat) * 50)}%`
    });

    if (latRange === 0 && lngRange === 0) {
      projected.set(point.key, { left: fallbackLeft(index), top: fallbackTop(index) });
    }
  });

  return projected;
}

function fallbackLeft(index: number): string {
  return `${34 + (index % 4) * 14}%`;
}

function fallbackTop(index: number): string {
  return `${36 + (index % 3) * 12}%`;
}

function formatServiceOpsError(error: unknown): string {
  const serviceError = error as Partial<ServiceOpsApiError>;
  if (serviceError?.status) {
    return ` (${serviceError.status}${serviceError.code ? `/${serviceError.code}` : ""})`;
  }

  return "";
}
