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
 * 운영자 세션이 살아 있는지 능동적으로 확인. 단순 쿠키 존재 검사로는 access
 * 만료 + refresh 쿠키 잔존 상태(브라우저는 access 쿠키만 만료시키고 refresh
 * 쿠키는 14일 까지 유지) 를 분간 못 해서, 세션이 사실상 만료됐는데도 페이지가
 * 진입한 뒤 데이터 로더가 silent-fail 하는 문제가 있었다.
 *
 * 정책:
 *   1. access / refresh 모두 없으면 → false (로그아웃 상태)
 *   2. access 가 있으면 → true (들어가서 페이지 로더가 실제 호출로 검증)
 *   3. access 없고 refresh 만 있으면 → 능동적으로 refresh 시도해서 access 를
 *      재발급. 성공하면 true, 실패하면 (refresh 도 만료/거부) cookie 정리 후
 *      false → page.tsx 가 `/login` 으로 redirect.
 */
export async function serviceOpsSessionReady(): Promise<boolean> {
  if (!serviceOpsApiConfigured()) {
    return false;
  }

  const cookieStore = await cookies();
  const { accessToken, refreshToken } = readServiceOpsSessionTokens(cookieStore);

  if (accessToken) return true;
  if (!refreshToken) return false;

  // access 만료 + refresh 잔존 — 능동 refresh. 실패 시 refresh* 함수가 내부
  // 적으로 cookie 정리까지 처리.
  return await refreshServiceOpsSessionCookies(cookieStore, createServiceOpsApiClient(), {
    secure: serviceOpsCookieSecure()
  });
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
