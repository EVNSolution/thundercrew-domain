import { NextResponse, type NextRequest } from "next/server";

// 미들웨어는 Next.js Edge runtime 에서 돌기 때문에 Node-only API 를
// 트랜지티브로 끌어올 수 있는 import 는 일부러 피한다. 쿠키 이름은 두
// 군데에서 같이 쓰이지만 게이트가 알아야 하는 정보는 이 두 줄뿐이라
// 인라인이 명료하다 (`service-ops-session-core` 와 변경 시 같이
// 맞춰야 한다는 주의 코멘트는 그쪽에도 둔다).
const SERVICE_OPS_ACCESS_TOKEN_COOKIE = "thundercrew_ops_access_token";
const SERVICE_OPS_REFRESH_TOKEN_COOKIE = "thundercrew_ops_refresh_token";

/**
 * 운영자 콘솔 입장 게이트. 인증 쿠키 (access / refresh) 가 둘 다 없으면
 * `/login` 으로 보낸다. 로그인 후 어디로 갈지는 signInAdmin 이 결정하고
 * 항상 루트(`/`) 로 리다이렉트하므로 여기서 `from=` 같은 복귀 경로는
 * 굳이 보존하지 않는다 — UX 가 단순해지고 미들웨어/로그인 액션 사이의
 * 책임이 명확해진다.
 *
 * 이미 로그인된 사용자가 다시 `/login` 으로 진입하면 루트로 돌려보낸다.
 * 그래야 운영자가 로그아웃 직후 다시 들어왔을 때나 북마크로 `/login` 을
 * 눌렀을 때 헷갈리지 않는다.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(SERVICE_OPS_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(SERVICE_OPS_REFRESH_TOKEN_COOKIE)?.value;
  const authenticated = Boolean(accessToken || refreshToken);

  if (pathname === "/login") {
    if (authenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!authenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
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
