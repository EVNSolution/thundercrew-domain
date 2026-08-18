import { NextResponse, type NextRequest } from "next/server";

// 미들웨어는 Next.js Edge runtime 에서 돌기 때문에 Node-only API 를
// 트랜지티브로 끌어올 수 있는 import 는 일부러 피한다. 쿠키 이름은 두
// 군데에서 같이 쓰이지만 게이트가 알아야 하는 정보는 이 두 줄뿐이라
// 인라인이 명료하다 (`service-ops-session-core` 와 변경 시 같이
// 맞춰야 한다는 주의 코멘트는 그쪽에도 둔다).
const SERVICE_OPS_ACCESS_TOKEN_COOKIE = "thundercrew_ops_access_token";
const SERVICE_OPS_REFRESH_TOKEN_COOKIE = "thundercrew_ops_refresh_token";

// 인증 API base URL. 빌드 타임에 박힌다 — 서버 사이드 전용 변수이지만 Edge
// 런타임에서도 `process.env.X` 로 접근 가능 (next.config 에서 노출 처리 안
// 해도 됨, 동일 프로세스 내 환경 변수).
const SERVICE_OPS_API_BASE_URL = process.env.SERVICE_OPS_API_BASE_URL ?? "";

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt: string;
};


/**
 * 운영자 콘솔 입장 게이트 + 만료 access token 자동 재발급.
 *
 * 1) 쿠키 자체가 둘 다 없으면 `/login` 으로 보낸다 (로그인 게이트).
 * 2) 이미 로그인된 사용자가 `/login` 으로 들어오면 루트로 돌려보낸다.
 * 3) access 가 만료/누락 + refresh 가 남아 있으면 — 이 미들웨어가 backend
 *    `/auth/refresh` 를 호출해 새 access/refresh 를 받아서 `request.cookies`
 *    (이 요청의 server component / page 가 즉시 새 토큰을 보도록) + 응답
 *    Set-Cookie (브라우저가 다음 요청부터 새 토큰을 보내도록) 둘 다에 박는다.
 *
 *    refresh 자체가 실패하면 — refresh 도 만료/거부 — 쿠키 둘 다 비우고
 *    `/login` 으로 보낸다.
 *
 *    이 책임이 server component 가 아니라 미들웨어에 있는 이유: Next.js 는
 *    server component 에서 cookies().set/delete 호출을 거부 (server action
 *    또는 route handler 에서만 허용). 미들웨어는 response.cookies / request.
 *    cookies API 로 합법적으로 cookie 를 set 할 수 있다.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // OTOPLUG NT 웹훅 수신기(/api/otoplug/nt/*)는 외부 단말 플랫폼이 세션 없이
  // 호출하는 공개 콜백 엔드포인트다. 인증게이트/호스트 리다이렉트보다 먼저
  // 통과시킨다 — 안 그러면 OTOPLUG POST 가 /login 으로 307 되어 핸들러까지
  // 못 간다. 실제 인증은 route handler 가 OTOPLUG-Channel-Token 헤더로 한다.
  if (pathname.startsWith("/api/otoplug/")) {
    return NextResponse.next();
  }

  // 라이더 웹은 제거됐다. 북마크나 예전 rider.* 서브도메인으로 들어오는 요청이
  // 404 대신 콘솔 루트를 보게 한다.
  if (pathname === "/rider" || pathname.startsWith("/rider/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const accessToken = request.cookies.get(SERVICE_OPS_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(SERVICE_OPS_REFRESH_TOKEN_COOKIE)?.value;

  if (pathname === "/login") {
    if (accessToken || refreshToken) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // access 살아 있으면 그대로 통과 — 가장 흔한 경로라 별도 fetch 없이 빠르게
  // 패스.
  if (accessToken) {
    return NextResponse.next();
  }

  // 여기까지 오면 access 없음 + refresh 있음 — 위의 두 분기로 인해 refresh
  // 는 반드시 정의돼 있다. TS narrowing 이 두 분기를 트랜시티브로 따라가지
  // 못해 명시적 guard 한 번 더.
  if (!refreshToken) {
    return clearAuthCookiesAndRedirectToLogin(request);
  }

  // 백엔드에 refresh 시도.
  if (!SERVICE_OPS_API_BASE_URL) {
    // base URL 미설정인데 refresh 쿠키만 박혀 있다면 — 환경 변수 누락이라
    // login 화면으로 정중히 돌려보내는 게 안전. 쿠키도 비워서 stale 상태가
    // 영구 잔존하지 않게.
    return clearAuthCookiesAndRedirectToLogin(request);
  }

  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed) {
    return clearAuthCookiesAndRedirectToLogin(request);
  }

  // 새 토큰을 (1) 이 요청의 cookies 에 inject 해서 SSR 단계의 server component
  // 가 즉시 fresh access 를 읽을 수 있게 하고, (2) 응답 Set-Cookie 로 박아서
  // 브라우저가 다음 요청부터 새 토큰을 보내도록.
  request.cookies.set(SERVICE_OPS_ACCESS_TOKEN_COOKIE, refreshed.accessToken);
  request.cookies.set(SERVICE_OPS_REFRESH_TOKEN_COOKIE, refreshed.refreshToken);

  const response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  // service-ops-session-core 의 serviceOpsCookieSecure() 와 같은 규칙이어야 한다.
  // 여기만 Secure 를 고집하면 평문 HTTP 프리뷰에서 로그인 쿠키는 살고
  // **자동 갱신된 쿠키만 브라우저가 버려서**, refresh 가 될 때마다 로그아웃되는
  // 더 헷갈리는 증상이 된다. (Edge 런타임이라 import 대신 규칙을 복제한다.)
  const secure =
    process.env.SERVICE_OPS_COOKIE_INSECURE === "true"
      ? false
      : process.env.NODE_ENV === "production";
  response.cookies.set({
    name: SERVICE_OPS_ACCESS_TOKEN_COOKIE,
    value: refreshed.accessToken,
    expires: parseCookieExpires(refreshed.expiresAt),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure
  });
  response.cookies.set({
    name: SERVICE_OPS_REFRESH_TOKEN_COOKIE,
    value: refreshed.refreshToken,
    expires: parseCookieExpires(refreshed.refreshExpiresAt),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure
  });

  return response;
}

async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse | null> {
  try {
    // `/api/v1` 를 빼먹으면 안 된다. env 의 BASE_URL 에는 접두사가 없고(API 클라이언트가
    // `${base}/api/v1${path}` 로 조립한다), 백엔드는 /api/v1/auth/refresh 만 매핑한다.
    // 실제로 접두사가 빠진 채 배포돼 자동 재발급이 항상 401 로 실패했고, 운영자는
    // access 만료 때마다 조용한 갱신 대신 /login 으로 밀려나 재로그인해야 했다.
    const result = await fetch(`${SERVICE_OPS_API_BASE_URL.replace(/\/+$/, "")}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      // Edge fetch 는 기본적으로 캐싱 안 하지만 명시적으로 박아둠.
      cache: "no-store"
    });
    if (!result.ok) return null;
    const json = (await result.json()) as RefreshResponse;
    if (!json.accessToken || !json.refreshToken) return null;
    return json;
  } catch {
    return null;
  }
}

function clearAuthCookiesAndRedirectToLogin(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SERVICE_OPS_ACCESS_TOKEN_COOKIE);
  response.cookies.delete(SERVICE_OPS_REFRESH_TOKEN_COOKIE);
  return response;
}

function parseCookieExpires(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(Date.now() + 30 * 60 * 1000) : parsed;
}

/**
 * matcher 는 negative-lookahead 로 정적 자산과 Next.js 내부 경로를
 * 비껴서 미들웨어가 모든 페이지 / 서버 액션 요청만 가로채도록 한다.
 * - `_next/static` / `_next/image` : Next.js 내부 빌드 자산.
 * - `favicon.ico` / 확장자가 있는 정적 파일 : 직접 서빙 대상.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
