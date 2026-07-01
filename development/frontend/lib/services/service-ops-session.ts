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

function serviceOpsCookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}
