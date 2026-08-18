import type * as MapLibreGL from "maplibre-gl";

/**
 * MapLibre 공용 설정. 콘솔 메인 지도 · 라이더 웹 지도 · 팁 좌표 미니맵이 전부 이걸 쓴다.
 *
 * 한 곳에 모으는 이유는 워커 경로 때문이다. 이 값이 화면마다 갈리면 **타일이 안 오는
 * 화면이 조용히 생긴다** — 지도는 회색으로 남고 콘솔에 "Failed to load module script"
 * 한 줄만 뜬다. 실제로 그렇게 났다.
 */

/**
 * 타일 소스. OpenFreeMap 은 키도 오리진 allowlist 도 없어서 어느 호스트·포트에서든
 * 뜬다. 무료지만 SLA 가 없으므로 운영 의존도가 커지면 자체 호스팅이나 유료 제공자로
 * 옮기게 된다 — 그때 바꿀 곳은 이 두 상수뿐이다.
 */
export const MAP_STYLE_LIGHT =
  process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ?? "https://tiles.openfreemap.org/styles/bright";
export const MAP_STYLE_DARK =
  process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? "https://tiles.openfreemap.org/styles/dark";

/**
 * 워커 스크립트 경로. **번들러를 태우지 않고 `public/` 에서 그대로 서빙한다.**
 *
 * `maplibre-gl-worker.mjs` 안에 `from "./maplibre-gl-shared.mjs"` 라는 해시 없는 상대
 * import 가 있다. 번들러(Turbopack)가 두 파일에 해시를 붙여 내보내면 그 경로가 404 가
 * 되고, 워커가 죽어 타일이 하나도 안 온다.
 *
 * `scripts/copy-maplibre-worker.mjs` 가 빌드마다 node_modules 에서 두 파일을 원본
 * 이름으로 복사해 둔다. 이 경로를 바꾸려면 그 스크립트도 같이 바꿔야 한다.
 */
export const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

/**
 * NCP·구글 계열은 세계를 256px 타일로 세고 MapLibre 는 512px 로 센다. 같은 배율을
 * 보려면 MapLibre 쪽 zoom 이 정확히 1 낮아야 한다. 호출부는 NCP 시절 숫자로 쓰여 있으니
 * 경계에서만 변환한다. 이 변환을 빼면 지도가 늘 2배 확대돼 뜬다.
 */
const ZOOM_SCALE_OFFSET = -1;
export const toMapZoom = (ncpZoom: number): number => ncpZoom + ZOOM_SCALE_OFFSET;
export const fromMapZoom = (mapZoom: number): number => mapZoom - ZOOM_SCALE_OFFSET;

let modulePromise: Promise<typeof MapLibreGL> | null = null;

/**
 * maplibre-gl 을 동적으로 불러오고 워커 경로를 지정한다.
 *
 * 동적 import 인 이유가 둘이다 — Next.js 가 컴포넌트를 서버에서 렌더할 때 `window` 를
 * 만지는 모듈이 평가되지 않고, 270KB(gzip) 짜리 청크가 첫 페인트를 막지 않는다.
 *
 * `setWorkerUrl` 은 첫 Map 생성 전에 불려야 하고 전역이라 한 번만 부르면 된다.
 * 결과 Promise 를 캐시해서 화면이 여러 개 떠도 중복 로드가 없다.
 */
export function loadMapLibre(): Promise<typeof MapLibreGL> {
  if (!modulePromise) {
    modulePromise = import("maplibre-gl").then((module) => {
      module.setWorkerUrl(MAPLIBRE_WORKER_URL);
      return module;
    });
  }
  return modulePromise;
}
