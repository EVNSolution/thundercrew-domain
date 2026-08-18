// maplibre-gl 의 워커 파일 두 개를 `public/maplibre/` 로 **원본 이름 그대로** 복사한다.
//
// 왜 필요한가: `maplibre-gl-worker.mjs` 안에는 `from "./maplibre-gl-shared.mjs"` 라는
// 해시 없는 상대 import 가 들어 있다. 번들러(Turbopack)가 이 둘을 에셋으로 내보내면서
// 파일명에 해시를 붙이면 — `maplibre-gl-shared.42a-zsm_2m_cu.mjs` — 워커가 요청하는
// `./maplibre-gl-shared.mjs` 는 404 가 된다. 워커는 조용히 죽고 **타일이 영영 안 온다.**
// 지도는 회색으로 남는데 콘솔에는 "Failed to load module script" 한 줄만 뜬다.
//
// 그래서 번들러를 태우지 않고 정적 파일로 그대로 서빙한다. 그러면 상대 import 가
// `/maplibre/maplibre-gl-shared.mjs` 로 정확히 풀린다. MapShell 이 `setWorkerUrl()`
// 로 이 경로를 지정한다.
//
// node_modules 에서 매 빌드마다 복사하므로 버전이 어긋날 일은 없다. 산출물이라
// `public/maplibre/` 는 커밋하지 않는다(.gitignore).
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve("maplibre-gl/package.json");
const distDir = join(dirname(packageJsonPath), "dist");

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(projectRoot, "public", "maplibre");

// 이 둘은 한 쌍이다. worker 만 복사하면 shared 를 못 찾아 위의 404 가 그대로 난다.
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

await mkdir(outDir, { recursive: true });
for (const file of FILES) {
  await copyFile(join(distDir, file), join(outDir, file));
}

const version = require("maplibre-gl/package.json").version;
console.log(`maplibre-gl ${version} worker → public/maplibre/ (${FILES.join(", ")})`);
