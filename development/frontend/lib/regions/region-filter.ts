/**
 * 관제 권역 필터 (4단계) — 행정구역 경계 기반 차량 필터.
 *
 * 경계 데이터는 `public/regions/` 에 번들된 단순화 GeoJSON 2종:
 *   sido.json    시도 17개 (광역/도 단위)
 *   sigungu.json 시군구 250개 (시/구 단위)
 *
 * 단위 4종은 파일 2개에서 파생한다:
 *   광역 = 시도 중 특별시·광역시·특별자치시
 *   도   = 시도 중 도·특별자치도
 *   구   = 시군구 중 이름이 "…구" (서울 종로구, 수원시장안구 모두)
 *   시   = 시군구 중 단독 시("의정부시") + "X시Y구" 분할 시의 X시 그룹
 *          (수원시 = 장안·권선·팔달·영통구 4개 폴리곤의 집합 — union 계산
 *          없이 "하나라도 포함이면 포함" 으로 판정)
 *
 * 판정은 bbox 프리필터 + ray casting. 단순화 경계라 접경 수십 m 오차는
 * 감수한다 — 모니터링 필터 용도로 충분하다.
 */

export type RegionUnit = "METRO" | "PROVINCE" | "CITY" | "DISTRICT";

export const REGION_UNIT_LABEL: Record<RegionUnit, string> = {
  METRO: "광역",
  PROVINCE: "도",
  CITY: "시",
  DISTRICT: "구"
};

/** localStorage 키 — 마지막 선택 유지 (계정 설정 아님, 기기 로컬). */
export const REGION_FILTER_STORAGE_KEY = "thundercrew-region-filter";

type Position = [number, number];
type PolygonCoords = Position[][];

export type RegionGeometry =
  | { type: "Polygon"; coordinates: PolygonCoords }
  | { type: "MultiPolygon"; coordinates: PolygonCoords[] };

export type RegionFeature = {
  type: "Feature";
  properties: { name: string; code: string };
  geometry: RegionGeometry;
};

export type RegionCollection = { type: "FeatureCollection"; features: RegionFeature[] };

/** 선택된 권역 — 이름 + 해당 폴리곤 feature 들(시 그룹은 여러 개). */
export type SelectedRegion = {
  unit: RegionUnit;
  name: string;
  features: RegionFeature[];
};

/**
 * localStorage 저장 형태 — 계단식 선택(도/시/구). 빈 문자열 = "전체".
 * feature 는 무겁고 재로드 가능하므로 제외한다.
 */
export type StoredRegionSelection = { sido: string; city: string; district: string } | null;

// ── 지역 목록 파생 ──────────────────────────────────────────────────

const METRO_SUFFIXES = ["특별시", "광역시", "특별자치시"];

export function isMetro(sidoName: string): boolean {
  return METRO_SUFFIXES.some((s) => sidoName.endsWith(s));
}

/** "서울특별시" → "서울", "경기도" → "경기" — 구·시 이름 접두용 단축명. */
export function sidoShortName(sidoName: string): string {
  return sidoName
    .replace(/특별자치시$|특별자치도$|특별시$|광역시$|도$/, "")
    .trim() || sidoName;
}

/** 시군구 code 앞 2자리 → 시도 단축명 사전. */
function sidoPrefixByCode(sido: RegionCollection): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of sido.features) {
    map.set(f.properties.code, sidoShortName(f.properties.name));
  }
  return map;
}

/**
 * 시군구 표시명 — "서울 중구", "경기 수원시장안구". 전국에 동명 구(중구 6개
 * 등)가 많아 bare 이름으로는 선택이 모호하다. 시도 접두가 유일화 키다.
 */
export function qualifiedSigunguName(feature: RegionFeature, sido: RegionCollection): string {
  const prefix = sidoPrefixByCode(sido).get(feature.properties.code.slice(0, 2));
  return prefix ? `${prefix} ${feature.properties.name}` : feature.properties.name;
}

/** "수원시장안구" → "수원시", "의정부시" → "의정부시", "종로구" → null */
export function cityNameOf(sigunguName: string): string | null {
  if (sigunguName.endsWith("시")) return sigunguName;
  const idx = sigunguName.indexOf("시");
  if (idx > 0 && sigunguName.endsWith("구")) {
    return sigunguName.slice(0, idx + 1);
  }
  return null;
}

// ── 계단식 선택 (도 → 시 → 구, 각 "전체") ──────────────────────────
//
// 사용자는 시도(라벨 "도")를 먼저 고르고, 그 안의 시/군, 다시 그 안의 구를
// 좁혀 간다. 각 단계 "전체" 허용 — 가장 구체적인 선택이 필터가 된다.

function sidoCodeOf(sido: RegionCollection, sidoName: string): string | null {
  return sido.features.find((f) => f.properties.name === sidoName)?.properties.code ?? null;
}

/** 시도 이름 17개 (광역·도 모두 — 계단식 첫 단계). */
export function listSidoNames(sido: RegionCollection): string[] {
  return sido.features.map((f) => f.properties.name).sort((a, b) => a.localeCompare(b, "ko"));
}

/**
 * 선택 시도의 시·군 목록. 분할 시("수원시장안구")는 시 이름으로 묶고,
 * 군("가평군")도 포함한다 — 시 select 가 없으면 군 지역은 필터 불가라서.
 * 시도가 이미 선택돼 있어 bare 이름으로 유일하다.
 */
export function listCityNames(sidoName: string, sido: RegionCollection, sigungu: RegionCollection): string[] {
  const code = sidoCodeOf(sido, sidoName);
  if (!code) return [];
  const set = new Set<string>();
  for (const f of sigungu.features) {
    if (!f.properties.code.startsWith(code)) continue;
    const name = f.properties.name;
    const city = cityNameOf(name);
    if (city) {
      set.add(city);
    } else if (name.endsWith("군")) {
      set.add(name);
    }
    // 광역시 직속 구는 시 단계가 아니라 구 단계에서 고른다.
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}

/**
 * 구 목록. 시가 선택돼 있으면 그 시의 분할 구("수원시장안구" → "장안구"),
 * 시 전체면 시도 직속 구(광역시의 "중구" 등). 표시 이름은 시 접두를 뗀
 * bare 이름 — 상위 선택으로 이미 유일하다.
 */
export function listDistrictNames(
  sidoName: string,
  cityName: string | null,
  sido: RegionCollection,
  sigungu: RegionCollection
): string[] {
  const code = sidoCodeOf(sido, sidoName);
  if (!code) return [];
  const names: string[] = [];
  for (const f of sigungu.features) {
    if (!f.properties.code.startsWith(code)) continue;
    const name = f.properties.name;
    if (!name.endsWith("구")) continue;
    const city = cityNameOf(name);
    if (cityName) {
      // "수원시장안구" 에서 시 이름을 뗀 "장안구".
      if (city === cityName && name !== cityName) {
        names.push(name.slice(cityName.length));
      }
    } else if (!city) {
      // 시 그룹에 속하지 않는 직속 구 (광역시 구).
      names.push(name);
    }
  }
  return names.sort((a, b) => a.localeCompare(b, "ko"));
}

/**
 * 계단식 선택 → 유효 권역. 가장 구체적인 비-전체 선택이 이긴다.
 * 전부 전체면 null (필터 없음).
 */
export function regionForSelection(
  selection: { sido: string; city: string; district: string },
  sido: RegionCollection,
  sigungu: RegionCollection
): SelectedRegion | null {
  const { sido: sidoName, city, district } = selection;
  if (!sidoName) return null;
  const code = sidoCodeOf(sido, sidoName);
  if (!code) return null;
  const inSido = sigungu.features.filter((f) => f.properties.code.startsWith(code));

  if (district) {
    // 시 선택 시 "장안구" → "수원시장안구", 시 전체면 직속 구 이름 그대로.
    const fullName = city && !district.startsWith(city) ? city + district : district;
    const features = inSido.filter((f) => f.properties.name === fullName);
    if (features.length === 0) return null;
    return { unit: "DISTRICT", name: `${sidoShortName(sidoName)} ${fullName}`, features };
  }
  if (city) {
    const features = inSido.filter(
      (f) => f.properties.name === city || cityNameOf(f.properties.name) === city
    );
    if (features.length === 0) return null;
    return { unit: "CITY", name: `${sidoShortName(sidoName)} ${city}`, features };
  }
  const features = sido.features.filter((f) => f.properties.name === sidoName);
  if (features.length === 0) return null;
  return { unit: isMetro(sidoName) ? "METRO" : "PROVINCE", name: sidoName, features };
}

/** 단위별 지역 이름 목록 (표시 순서: 가나다). */
export function listRegionNames(unit: RegionUnit, sido: RegionCollection, sigungu: RegionCollection): string[] {
  let names: string[];
  switch (unit) {
    case "METRO":
      names = sido.features.map((f) => f.properties.name).filter(isMetro);
      break;
    case "PROVINCE":
      names = sido.features.map((f) => f.properties.name).filter((n) => !isMetro(n));
      break;
    case "CITY": {
      const prefixByCode = sidoPrefixByCode(sido);
      const set = new Set<string>();
      for (const f of sigungu.features) {
        const city = cityNameOf(f.properties.name);
        if (!city) continue;
        const prefix = prefixByCode.get(f.properties.code.slice(0, 2));
        set.add(prefix ? `${prefix} ${city}` : city);
      }
      names = [...set];
      break;
    }
    case "DISTRICT":
      names = sigungu.features
        .filter((f) => f.properties.name.endsWith("구"))
        .map((f) => qualifiedSigunguName(f, sido));
      break;
  }
  return names.sort((a, b) => a.localeCompare(b, "ko"));
}

/** 선택 이름에 해당하는 폴리곤 feature 들. 시 그룹은 분할 구를 전부 포함. */
export function featuresForRegion(
  unit: RegionUnit,
  name: string,
  sido: RegionCollection,
  sigungu: RegionCollection
): RegionFeature[] {
  if (unit === "METRO" || unit === "PROVINCE") {
    return sido.features.filter((f) => f.properties.name === name);
  }
  if (unit === "DISTRICT") {
    return sigungu.features.filter((f) => qualifiedSigunguName(f, sido) === name);
  }
  // CITY — "시도 X시" 접두 이름. 단독 시 1개 또는 "X시Y구" 분할 그룹.
  return sigungu.features.filter((f) => {
    const city = cityNameOf(f.properties.name);
    if (!city) return false;
    const prefix = sidoShortName(
      sido.features.find((s) => s.properties.code === f.properties.code.slice(0, 2))?.properties.name ?? ""
    );
    const qualified = prefix ? `${prefix} ${city}` : city;
    return qualified === name;
  });
}

// ── point-in-polygon ────────────────────────────────────────────────

type Bbox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

function ringBbox(rings: PolygonCoords, into: Bbox): void {
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < into[0]) into[0] = lng;
      if (lat < into[1]) into[1] = lat;
      if (lng > into[2]) into[2] = lng;
      if (lat > into[3]) into[3] = lat;
    }
  }
}

export function featureBbox(feature: RegionFeature): Bbox {
  const bbox: Bbox = [Infinity, Infinity, -Infinity, -Infinity];
  if (feature.geometry.type === "Polygon") {
    ringBbox(feature.geometry.coordinates, bbox);
  } else {
    for (const poly of feature.geometry.coordinates) ringBbox(poly, bbox);
  }
  return bbox;
}

/** ray casting — ring 은 [lng, lat] 목록. 경계선 위는 포함으로 본다. */
function pointInRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygonCoords(lng: number, lat: number, rings: PolygonCoords): boolean {
  if (rings.length === 0 || !pointInRing(lng, lat, rings[0])) return false;
  // 구멍(hole) 안이면 제외.
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false;
  }
  return true;
}

export function pointInFeature(lng: number, lat: number, feature: RegionFeature, bbox?: Bbox): boolean {
  const b = bbox ?? featureBbox(feature);
  if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) return false;
  if (feature.geometry.type === "Polygon") {
    return pointInPolygonCoords(lng, lat, feature.geometry.coordinates);
  }
  return feature.geometry.coordinates.some((poly) => pointInPolygonCoords(lng, lat, poly));
}

/** 선택 권역(여러 폴리곤일 수 있음)에 좌표가 들어가는가. */
export function pointInRegion(lng: number, lat: number, region: SelectedRegion): boolean {
  return region.features.some((f) => pointInFeature(lng, lat, f));
}

/** 권역 전체 bbox — 지도 fit 용 [[lng,lat],[lng,lat]] 두 점. */
export function regionFitPoints(region: SelectedRegion): Array<{ latitude: number; longitude: number }> {
  const bbox: Bbox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of region.features) {
    const b = featureBbox(f);
    if (b[0] < bbox[0]) bbox[0] = b[0];
    if (b[1] < bbox[1]) bbox[1] = b[1];
    if (b[2] > bbox[2]) bbox[2] = b[2];
    if (b[3] > bbox[3]) bbox[3] = b[3];
  }
  return [
    { latitude: bbox[1], longitude: bbox[0] },
    { latitude: bbox[3], longitude: bbox[2] }
  ];
}
