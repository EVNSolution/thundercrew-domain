/**
 * NCP Maps Web SDK 의 base 스크립트(`maps.js`) 를 1회만 로드하는 공유 로더.
 *
 * `components/dashboard/MapShell.tsx` 가 이미 같은 base 스크립트를
 * `data-id="ncp-maps-sdk-base"` + `?ncpKeyId=` 로 주입한다. 미니맵(팁 다이얼로그)
 * 들이 각자 다른 selector / 다른 query param 으로 스크립트를 또 주입하면
 *   - SDK 사본이 두 번 로드되거나
 *   - 잘못된/누락된 client id 로 런타임 인증이 깨진다.
 * 그래서 MapShell 과 **동일한** `data-id` 와 `ncpKeyId` param 을 그대로 재사용해
 * 기존 태그가 있으면 붙어서 기다리고, 없으면 같은 형태로 한 번만 만든다.
 *
 * 미니맵은 GL 서브모듈(`maps-gl.js`) 이 필요 없다 (`new naver.maps.Map` +
 * `Marker` + `Event` + `LatLng` 만 사용). base SDK 가 `window.naver.maps` 를
 * 채우면 그걸로 충분하므로 GL companion 은 건드리지 않는다.
 *
 * env var / script id / query param 모두 MapShell 의 상수와 일치해야 한다.
 */

const NCP_CLIENT_ID = process.env.NEXT_PUBLIC_NCP_MAP_CLIENT_ID;
const SDK_BASE_URL = "https://oapi.map.naver.com/openapi/v3/maps.js";
const SDK_BASE_SCRIPT_ID = "ncp-maps-sdk-base";

/**
 * base SDK 가 준비되면 resolve. SDK 가 이미 로드돼 있으면 즉시 resolve,
 * MapShell 이 막 주입해 둔 태그가 있으면 그 `load` 를 기다린다. client id 가
 * 없으면 reject — 호출 측이 미니맵을 그릴 수 없는 상태를 인지하게 한다.
 */
export function loadNcpMapsSdk(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("NCP Maps SDK can only load in the browser."));
  }
  if (window.naver?.maps?.Map) {
    return Promise.resolve();
  }
  if (!NCP_CLIENT_ID) {
    return Promise.reject(new Error("NEXT_PUBLIC_NCP_MAP_CLIENT_ID 가 설정되지 않았습니다."));
  }

  return new Promise<void>((resolve, reject) => {
    const onLoaded = () => {
      if (window.naver?.maps?.Map) resolve();
      else reject(new Error("NCP Maps SDK 가 로드됐지만 초기화되지 않았습니다."));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-id="${SDK_BASE_SCRIPT_ID}"]`,
    );
    if (existing) {
      if (window.naver?.maps?.Map) {
        resolve();
        return;
      }
      existing.addEventListener("load", onLoaded, { once: true });
      existing.addEventListener("error", () => reject(new Error("NCP Maps SDK 로드 실패")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    // MapShell 과 동일하게 `ncpKeyId` 로 인증 (신규 NCP Maps 서비스). `async=false`
    // 로 순서를 보존해 다른 곳에서 GL companion 을 붙일 때도 base 가 먼저 끝난다.
    script.src = `${SDK_BASE_URL}?ncpKeyId=${encodeURIComponent(NCP_CLIENT_ID)}`;
    script.async = false;
    script.dataset.id = SDK_BASE_SCRIPT_ID;
    script.addEventListener("load", onLoaded, { once: true });
    script.addEventListener("error", () => reject(new Error("NCP Maps SDK 로드 실패")), {
      once: true,
    });
    document.head.appendChild(script);
  });
}
