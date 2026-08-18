import { cookies } from "next/headers";

import {
  type ServiceOpsApiClient,
  type ServiceOpsAuthResponse,
  createServiceOpsApiClient,
  serviceOpsApiConfigured
} from "./service-ops-api";
import {
  clearServiceOpsSessionCookies,
  logoutServiceOpsSessionCookies,
  readServiceOpsSessionTokens,
  refreshServiceOpsSessionCookies,
  setServiceOpsSessionCookies
} from "./service-ops-session-core";

export type CreateAuthenticatedServiceOpsApiClientOptions = {
  refreshIfMissing?: boolean;
};

export async function createAuthenticatedServiceOpsApiClient({
  refreshIfMissing = false
}: CreateAuthenticatedServiceOpsApiClientOptions = {}): Promise<ServiceOpsApiClient | null> {
  if (!serviceOpsApiConfigured()) {
    return null;
  }

  const cookieStore = await cookies();
  let { accessToken } = readServiceOpsSessionTokens(cookieStore);

  if (!accessToken && refreshIfMissing) {
    const refreshed = await refreshServiceOpsSessionCookies(cookieStore, createServiceOpsApiClient(), {
      secure: serviceOpsCookieSecure()
    });

    if (!refreshed) {
      return null;
    }

    accessToken = readServiceOpsSessionTokens(cookieStore).accessToken;
  }

  if (!accessToken) {
    return null;
  }

  return createServiceOpsApiClient({ accessToken });
}

export async function getServiceOpsAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return readServiceOpsSessionTokens(cookieStore).accessToken;
}

export async function getServiceOpsRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return readServiceOpsSessionTokens(cookieStore).refreshToken;
}

/**
 * 운영자 세션이 살아 있는지 read-only 로 확인. server component (page.tsx,
 * AppShell 등) 가 호출해도 안전하도록 cookie set/delete 는 하지 않는다.
 *
 * 정책:
 *   1. access 가 있으면 → true (들어가서 페이지 로더가 실제 호출로 검증)
 *   2. access 가 없으면 → false (`/login` 으로 redirect)
 *
 * **만료된 access 의 능동 refresh 는 미들웨어가 처리한다.** access 가 비어
 * 있고 refresh 가 살아 있는 케이스에서, server component 가 SSR 도중
 * `cookies().set()` 으로 새 토큰을 박는 것이 Next.js 15 의 cookie write
 * 제약에 걸려 prod 에서 generic 에러 페이지가 떴다. 같은 작업을 미들웨어 단
 * 에서 하면 (1) request.cookies 에 인젝트해서 이번 SSR 부터 fresh access 가
 * 보이고, (2) response Set-Cookie 로 브라우저도 갱신된다. `middleware.ts` 참고.
 */
export async function serviceOpsSessionReady(): Promise<boolean> {
  if (!serviceOpsApiConfigured()) {
    return false;
  }

  const cookieStore = await cookies();
  const { accessToken } = readServiceOpsSessionTokens(cookieStore);
  return Boolean(accessToken);
}

export async function refreshServiceOpsSession(): Promise<boolean> {
  if (!serviceOpsApiConfigured()) {
    await clearServiceOpsSession();
    return false;
  }

  const cookieStore = await cookies();
  return refreshServiceOpsSessionCookies(cookieStore, createServiceOpsApiClient(), {
    secure: serviceOpsCookieSecure()
  });
}

export async function setServiceOpsSession(auth: ServiceOpsAuthResponse): Promise<void> {
  const cookieStore = await cookies();
  setServiceOpsSessionCookies(cookieStore, auth, { secure: serviceOpsCookieSecure() });
}

export async function clearServiceOpsSession(): Promise<void> {
  const cookieStore = await cookies();
  clearServiceOpsSessionCookies(cookieStore);
}

export async function logoutServiceOpsSession(): Promise<void> {
  const cookieStore = await cookies();
  await logoutServiceOpsSessionCookies(cookieStore, {
    configured: serviceOpsApiConfigured(),
    createClient: (accessToken) => createServiceOpsApiClient({ accessToken })
  });
}

/**
 * 세션 쿠키에 `Secure` 를 붙일지.
 *
 * 기본은 운영 빌드에서 항상 붙인다. 다만 **평문 HTTP 로 접근하는 프리뷰**에서는 브라우저가
 * Secure 쿠키를 저장하지 않아 로그인 직후 화면은 보이지만 다음 요청부터 세션이 없어
 * `/login` 으로 되돌아간다. 인증이 필요한 QA 자체가 불가능해진다.
 *
 * `next start` 가 NODE_ENV 를 production 으로 강제하므로 env 에서 지우는 것으로는 풀리지
 * 않는다. 그래서 명시적 옵트아웃을 둔다.
 *
 * **이 변수는 프리뷰 전용이다.** 설정하지 않으면 운영 동작이 그대로이고, 이름에
 * `INSECURE` 를 넣어 무엇을 포기하는지 드러냈다. 운영 호스트의 env 에는 절대 넣지 않는다 —
 * 넣으면 관리자 세션 쿠키가 평문으로 흐른다.
 *
 * 근본 해결은 프리뷰에 TLS 를 붙이는 것이다. 그때 이 변수를 지운다.
 */
function serviceOpsCookieSecure(): boolean {
  if (process.env.SERVICE_OPS_COOKIE_INSECURE === "true") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}
