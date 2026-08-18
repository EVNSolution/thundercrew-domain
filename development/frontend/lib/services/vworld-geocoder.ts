/**
 * VWorld(국토교통부 브이월드) 지오코더 + 주소 검색 (server-side).
 *
 * 공공 무료 API — 키만 발급받으면 일 40,000건까지 무상이라 NCP 요금
 * 걱정 없이 배차 지오코딩을 돌릴 수 있다. 두 엔드포인트를 쓴다:
 *
 *   Geocoder 2.0 (req/address, getCoord) — 주소 문자열 → 좌표.
 *     도로명(ROAD) 먼저, 실패하면 지번(PARCEL) 재시도.
 *   검색 2.0 (req/search, type=ADDRESS)  — 키워드 → 주소 후보 목록(+좌표).
 *     배차 폼의 주소 검색 드롭다운이 쓴다. 결과에 좌표가 실려 오므로
 *     선택 즉시 좌표까지 확정된다 (별도 지오코딩 불필요).
 *
 * 키는 서버 전용 env `VWORLD_API_KEY` — 클라이언트 번들에 싣지 않는다.
 * 실패 시 null/[] 반환 — 폴백 정책(NCP 재시도 등)은 호출 측이 정한다.
 */

import type { GeocodedCoordinates } from "@/lib/services/ncp-geocoder";

const VWORLD_GEOCODE_ENDPOINT = "https://api.vworld.kr/req/address";
const VWORLD_SEARCH_ENDPOINT = "https://api.vworld.kr/req/search";

export function vworldConfigured(): boolean {
  return Boolean(process.env.VWORLD_API_KEY);
}

interface VworldGeocodeResponse {
  response?: {
    status?: string;
    result?: { point?: { x?: string; y?: string } };
  };
}

async function getCoord(address: string, type: "ROAD" | "PARCEL", key: string): Promise<GeocodedCoordinates | null> {
  const params = new URLSearchParams({
    service: "address",
    request: "getCoord",
    version: "2.0",
    crs: "EPSG:4326",
    format: "json",
    refine: "true",
    simple: "false",
    type,
    address,
    key
  });
  let response: Response;
  try {
    response = await fetch(`${VWORLD_GEOCODE_ENDPOINT}?${params}`, {
      method: "GET",
      cache: "no-store"
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let body: VworldGeocodeResponse;
  try {
    body = (await response.json()) as VworldGeocodeResponse;
  } catch {
    return null;
  }
  const point = body.response?.status === "OK" ? body.response.result?.point : undefined;
  if (!point?.x || !point?.y) return null;
  const longitude = Number.parseFloat(point.x);
  const latitude = Number.parseFloat(point.y);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return { latitude, longitude };
}

/** 주소 → 좌표. 도로명 우선, 지번 재시도. 키 미설정/실패 시 null. */
export async function vworldGeocode(address: string): Promise<GeocodedCoordinates | null> {
  const trimmed = address.trim();
  const key = process.env.VWORLD_API_KEY;
  if (!trimmed || !key) return null;
  return (await getCoord(trimmed, "ROAD", key)) ?? (await getCoord(trimmed, "PARCEL", key));
}

// ── 주소 검색 (배차 폼 드롭다운) ────────────────────────────────────

export interface AddressSearchResult {
  /** 대표 표시 주소 — 도로명 우선, 없으면 지번. */
  address: string;
  roadAddress: string | null;
  parcelAddress: string | null;
  latitude: number;
  longitude: number;
}

interface VworldSearchResponse {
  response?: {
    status?: string;
    result?: {
      items?: Array<{
        address?: { road?: string; parcel?: string };
        point?: { x?: string; y?: string };
      }>;
    };
  };
}

async function searchOnce(
  query: string,
  category: "ROAD" | "PARCEL",
  key: string
): Promise<AddressSearchResult[]> {
  const params = new URLSearchParams({
    service: "search",
    request: "search",
    version: "2.0",
    crs: "EPSG:4326",
    format: "json",
    type: "ADDRESS",
    category,
    size: "10",
    page: "1",
    query,
    key
  });
  let response: Response;
  try {
    response = await fetch(`${VWORLD_SEARCH_ENDPOINT}?${params}`, {
      method: "GET",
      cache: "no-store"
    });
  } catch {
    return [];
  }
  if (!response.ok) return [];

  let body: VworldSearchResponse;
  try {
    body = (await response.json()) as VworldSearchResponse;
  } catch {
    return [];
  }
  if (body.response?.status !== "OK") return [];

  const results: AddressSearchResult[] = [];
  for (const item of body.response.result?.items ?? []) {
    const road = item.address?.road?.trim() || null;
    const parcel = item.address?.parcel?.trim() || null;
    const display = road ?? parcel;
    const longitude = Number.parseFloat(item.point?.x ?? "");
    const latitude = Number.parseFloat(item.point?.y ?? "");
    if (!display || !Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    results.push({ address: display, roadAddress: road, parcelAddress: parcel, latitude, longitude });
  }
  return results;
}

/**
 * 주소 키워드 검색 — 도로명 결과 우선, 모자라면 지번 결과로 보충 (주소
 * 문자열 기준 중복 제거, 최대 10건). 키 미설정/실패 시 빈 배열.
 */
export async function vworldSearchAddress(query: string): Promise<AddressSearchResult[]> {
  const trimmed = query.trim();
  const key = process.env.VWORLD_API_KEY;
  if (!trimmed || !key) return [];

  const road = await searchOnce(trimmed, "ROAD", key);
  if (road.length >= 10) return road.slice(0, 10);

  const parcel = await searchOnce(trimmed, "PARCEL", key);
  const seen = new Set(road.map((r) => r.address));
  const merged = [...road];
  for (const item of parcel) {
    if (seen.has(item.address)) continue;
    seen.add(item.address);
    merged.push(item);
    if (merged.length >= 10) break;
  }
  return merged;
}
