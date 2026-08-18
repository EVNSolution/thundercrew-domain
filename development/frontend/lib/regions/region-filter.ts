/**
 * 관제 권역 필터 — 대한민국 행정구역 3단계 체계를 그대로 따른다.
 *
 *   1단계 광역자치단체: 특별시·광역시·특별자치시·도·특별자치도 (17 시·도)
 *   2단계 기초자치단체: 시·군·자치구 (광역시의 구는 자치구 = 2단계)
 *   3단계 하부 단위:    읍·면·동. 인구 50만 이상 대도시의 일반구(수원시
 *                       장안구 등, 자치권 없음)도 이 단계에서 고른다.
 *
 * 경계 데이터 (public/regions/, 통계청 kostat 2018 단순화본):
 *   sido.json          시·도 17
 *   sigungu.json       시·군·구 250 (일반구 분할 포함 — code 5자리)
 *   emd/{시도2자리}.json 읍·면·동 (code 7자리 = 시군구 5 + 동 2, 시도별 분할)
 *
 * 판정은 bbox 프리필터 + ray casting. 단순화 경계라 접경 수십 m 오차는
 * 감수한다 — 모니터링 필터 용도로 충분하다.
 */

export type RegionUnit = "METRO" | "PROVINCE" | "CITY" | "DISTRICT" | "EMD";

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

/** 선택된 권역 — 이름 + 해당 폴리곤 feature 들(분할시 그룹은 여러 개). */
export type SelectedRegion = {
  unit: RegionUnit;
  name: string;
  features: RegionFeature[];
};

/**
 * localStorage 저장 형태 — 행정 3단계 선택. 빈 문자열/빈 배열 = "전체".
 * 3단계(읍·면·동/일반구)는 다중 선택이라 배열. feature 는 무겁고 재로드
 * 가능하므로 제외한다. 구버전 `sub: string` 저장값은 복원 시 배열로 승격.
 */
export type StoredRegionSelection = { sido: string; basic: string; subs: string[] } | null;

// ── 이름 파생 ───────────────────────────────────────────────────────

const METRO_SUFFIXES = ["특별시", "광역시", "특별자치시"];

export function isMetro(sidoName: string): boolean {
  return METRO_SUFFIXES.some((s) => sidoName.endsWith(s));
}

/** "서울특별시" → "서울", "경기도" → "경기" — 표시명 접두용 단축명. */
export function sidoShortName(sidoName: string): string {
  return sidoName
    .replace(/특별자치시$|특별자치도$|특별시$|광역시$|도$/, "")
    .trim() || sidoName;
}

/** "수원시장안구" → "수원시" (분할시 그룹명), "의정부시"/"종로구" → null */
export function splitCityOf(sigunguName: string): string | null {
  const idx = sigunguName.indexOf("시");
  if (idx > 0 && idx < sigunguName.length - 1 && sigunguName.endsWith("구")) {
    return sigunguName.slice(0, idx + 1);
  }
  return null;
}

function sidoCodeOf(sido: RegionCollection, sidoName: string): string | null {
  return sido.features.find((f) => f.properties.name === sidoName)?.properties.code ?? null;
}

/** 1단계 — 시·도 17개. */
export function listSidoNames(sido: RegionCollection): string[] {
  return sido.features.map((f) => f.properties.name).sort((a, b) => a.localeCompare(b, "ko"));
}

/**
 * 2단계 — 기초자치단체 (시·군·자치구). 광역시의 구(자치구)도 여기다.
 * 일반구로 분할된 시("수원시장안구"…)는 시 이름 하나로 묶는다.
 */
export function listBasicNames(sidoName: string, sido: RegionCollection, sigungu: RegionCollection): string[] {
  const code = sidoCodeOf(sido, sidoName);
  if (!code) return [];
  const set = new Set<string>();
  for (const f of sigungu.features) {
    if (!f.properties.code.startsWith(code)) continue;
    const name = f.properties.name;
    const split = splitCityOf(name);
    set.add(split ?? name);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}

/** 선택 기초자치단체에 속하는 시군구 feature 들 (분할시는 일반구 전부). */
function basicFeatures(
  sidoCode: string,
  basicName: string,
  sigungu: RegionCollection
): RegionFeature[] {
  return sigungu.features.filter((f) => {
    if (!f.properties.code.startsWith(sidoCode)) return false;
    const name = f.properties.name;
    return name === basicName || splitCityOf(name) === basicName;
  });
}

/**
 * 3단계 — 하부 단위 이름 목록.
 *   분할시(일반구 보유): 일반구 목록 ("수원시장안구" → "장안구")
 *   그 외(자치구·군·단일시): 읍·면·동 (emd 컬렉션에서 해당 코드 prefix)
 * emd 는 시도별 lazy fetch 라 null 이면 (아직 미로드) 빈 배열.
 */
export function listSubNames(
  sidoName: string,
  basicName: string,
  sido: RegionCollection,
  sigungu: RegionCollection,
  emd: RegionCollection | null
): string[] {
  const code = sidoCodeOf(sido, sidoName);
  if (!code || !basicName) return [];
  const features = basicFeatures(code, basicName, sigungu);
  if (features.length === 0) return [];

  const isSplitCity = features.length > 1 || splitCityOf(features[0].properties.name) === basicName;
  if (isSplitCity) {
    return features
      .map((f) => f.properties.name.slice(basicName.length))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "ko"));
  }

  if (!emd) return [];
  const basicCode = features[0].properties.code;
  return emd.features
    .filter((f) => f.properties.code.startsWith(basicCode))
    .map((f) => f.properties.name)
    .sort((a, b) => a.localeCompare(b, "ko"));
}

/**
 * 3단계 값 하나 해석 — 분할시 일반구(DISTRICT) 또는 읍·면·동(EMD).
 * emd 미로드(null)면 읍·면·동은 못 푼다.
 */
function subFeaturesFor(
  sidoCode: string,
  basic: string,
  sub: string,
  sigungu: RegionCollection,
  emd: RegionCollection | null
): { unit: "DISTRICT" | "EMD"; features: RegionFeature[] } | null {
  const inBasic = basicFeatures(sidoCode, basic, sigungu);
  // 분할시의 일반구 — "장안구" → "수원시장안구" feature.
  const districtFull = inBasic.find((f) => f.properties.name === basic + sub);
  if (districtFull) {
    return { unit: "DISTRICT", features: [districtFull] };
  }
  // 읍·면·동 — 기초 코드 prefix 안에서 이름 매칭.
  if (emd && inBasic.length === 1) {
    const basicCode = inBasic[0].properties.code;
    const features = emd.features.filter(
      (f) => f.properties.code.startsWith(basicCode) && f.properties.name === sub
    );
    if (features.length > 0) {
      return { unit: "EMD", features };
    }
  }
  return null;
}

/**
 * 3단계 다중 선택 중 현재 데이터로 해석되는 것만 추린다 (입력 순서 유지).
 * 호출부가 select 표시·저장값을 실제 필터와 동기화하는 데 쓴다.
 */
export function resolvableSubs(
  selection: { sido: string; basic: string; subs: string[] },
  sido: RegionCollection,
  sigungu: RegionCollection,
  emd: RegionCollection | null
): string[] {
  const code = sidoCodeOf(sido, selection.sido);
  if (!code || !selection.basic) return [];
  return selection.subs.filter((sub) => subFeaturesFor(code, selection.basic, sub, sigungu, emd) !== null);
}

/**
 * 계단식 선택 → 유효 권역. 가장 구체적인 비-전체 선택이 이긴다.
 * 전부 전체면 null (필터 없음). 3단계는 다중 선택 — 해석되는 것들의
 * 폴리곤 합집합이 권역이고, 하나도 못 풀면 기초 단위로 강등.
 */
export function regionForSelection(
  selection: { sido: string; basic: string; subs: string[] },
  sido: RegionCollection,
  sigungu: RegionCollection,
  emd: RegionCollection | null
): SelectedRegion | null {
  const { sido: sidoName, basic, subs } = selection;
  if (!sidoName) return null;
  const code = sidoCodeOf(sido, sidoName);
  if (!code) return null;
  const short = sidoShortName(sidoName);

  if (basic && subs.length > 0) {
    let unit: "DISTRICT" | "EMD" | null = null;
    const features: RegionFeature[] = [];
    const resolved: string[] = [];
    for (const sub of subs) {
      const hit = subFeaturesFor(code, basic, sub, sigungu, emd);
      if (!hit) continue;
      // 한 기초 안에서 3단계는 일반구든 읍·면·동이든 한 종류다 — 첫 해석의
      // unit 을 따른다.
      unit = unit ?? hit.unit;
      features.push(...hit.features);
      resolved.push(sub);
    }
    if (unit && features.length > 0) {
      const label =
        resolved.length === 1 ? resolved[0] : `${resolved[0]} 외 ${resolved.length - 1}`;
      return { unit, name: `${short} ${basic} ${label}`, features };
    }
    // 전부 해석 실패면 기초 단위로 강등.
  }
  if (basic) {
    const features = basicFeatures(code, basic, sigungu);
    if (features.length === 0) return null;
    return { unit: "CITY", name: `${short} ${basic}`, features };
  }
  const features = sido.features.filter((f) => f.properties.name === sidoName);
  if (features.length === 0) return null;
  return { unit: isMetro(sidoName) ? "METRO" : "PROVINCE", name: sidoName, features };
}

/** 시도 이름 → emd 파일 경로 (public/regions/emd/{code2}.json). */
export function emdPathForSido(sidoName: string, sido: RegionCollection): string | null {
  const code = sidoCodeOf(sido, sidoName);
  return code ? `/regions/emd/${code.slice(0, 2)}.json` : null;
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

/**
 * 반복 판정용 tester — feature bbox 를 한 번만 계산해 클로저에 캐시한다.
 * 폴링 tick 마다 권역 판정을 도는 호출부(마커 dimmed 등)가 쓴다.
 */
export function makeRegionTester(region: SelectedRegion): (lng: number, lat: number) => boolean {
  const entries = region.features.map((f) => ({ feature: f, bbox: featureBbox(f) }));
  return (lng, lat) => entries.some((e) => pointInFeature(lng, lat, e.feature, e.bbox));
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
