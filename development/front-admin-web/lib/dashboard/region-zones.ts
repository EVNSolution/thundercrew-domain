// Static region polygon paths used to highlight selected zones on /dashboard.
// Real backend integration will replace this with administrative-district
// GeoJSON; for now this matches the three mock regions in
// `dashboard-map-data.mockDashboardMapData()`.

export type LatLngPath = ReadonlyArray<{ lat: number; lng: number }>;

const REGION_ZONES: Record<string, LatLngPath> = {
  "강남/역삼": [
    { lat: 37.5158, lng: 127.0249 },
    { lat: 37.5158, lng: 127.0561 },
    { lat: 37.4948, lng: 127.0612 },
    { lat: 37.4928, lng: 127.0309 },
  ],
  "서초/방배": [
    { lat: 37.4998, lng: 127.0136 },
    { lat: 37.4985, lng: 127.0427 },
    { lat: 37.4720, lng: 127.0445 },
    { lat: 37.4742, lng: 127.0162 },
  ],
  "송파/잠실": [
    { lat: 37.5302, lng: 127.0815 },
    { lat: 37.5298, lng: 127.1248 },
    { lat: 37.4979, lng: 127.1252 },
    { lat: 37.4993, lng: 127.0832 },
  ],
};

export function getRegionZonePath(name: string): LatLngPath | undefined {
  return REGION_ZONES[name];
}
