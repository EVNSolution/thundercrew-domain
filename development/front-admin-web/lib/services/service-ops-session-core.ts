import type { ServiceOpsApiClient, ServiceOpsAuthResponse } from "./service-ops-api";

// 이 두 쿠키 이름은 `middleware.ts` 가 Edge runtime 제약 때문에 인라인
// 으로 복사해서 쓴다. 값을 바꿀 때 미들웨어도 같이 맞춰야 게이트가
// 새 쿠키를 인식한다.
export const SERVICE_OPS_ACCESS_TOKEN_COOKIE = "thundercrew_ops_access_token";
export const SERVICE_OPS_REFRESH_TOKEN_COOKIE = "thundercrew_ops_refresh_token";

export type ServiceOpsSessionCookieOptions = {
  expires: Date;
  httpOnly: true;
  path: "/";
  sameSite: "lax";
  secure: boolean;
};

export type ServiceOpsSessionCookieStore = {
  get: (name: string) => { value: string } | undefined;
  set: (name: string, value: string, options: ServiceOpsSessionCookieOptions) => void;
  delete: (name: string) => void;
};

export type ServiceOpsSessionCookieSecurity = {
  secure: boolean;
};

export type ServiceOpsSessionTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

export type ServiceOpsLogoutOptions = {
  configured: boolean;
  createClient: (accessToken: string) => Pick<ServiceOpsApiClient, "logout">;
};

export function readServiceOpsSessionTokens(cookieStore: Pick<ServiceOpsSessionCookieStore, "get">): ServiceOpsSessionTokens {
  return {
    accessToken: cookieStore.get(SERVICE_OPS_ACCESS_TOKEN_COOKIE)?.value ?? null,
    refreshToken: cookieStore.get(SERVICE_OPS_REFRESH_TOKEN_COOKIE)?.value ?? null
  };
}

export function setServiceOpsSessionCookies(
  cookieStore: ServiceOpsSessionCookieStore,
  auth: ServiceOpsAuthResponse,
  { secure }: ServiceOpsSessionCookieSecurity
): void {
  cookieStore.set(SERVICE_OPS_ACCESS_TOKEN_COOKIE, auth.accessToken, serviceOpsCookieOptions(auth.expiresAt, secure));
  cookieStore.set(SERVICE_OPS_REFRESH_TOKEN_COOKIE, auth.refreshToken, serviceOpsCookieOptions(auth.refreshExpiresAt, secure));
}

export function clearServiceOpsSessionCookies(cookieStore: Pick<ServiceOpsSessionCookieStore, "delete">): void {
  cookieStore.delete(SERVICE_OPS_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(SERVICE_OPS_REFRESH_TOKEN_COOKIE);
}

export async function refreshServiceOpsSessionCookies(
  cookieStore: ServiceOpsSessionCookieStore,
  client: Pick<ServiceOpsApiClient, "refresh">,
  security: ServiceOpsSessionCookieSecurity
): Promise<boolean> {
  const { refreshToken } = readServiceOpsSessionTokens(cookieStore);

  if (!refreshToken) {
    return false;
  }

  try {
    const auth = await client.refresh({ refreshToken });
    setServiceOpsSessionCookies(cookieStore, auth, security);
    return true;
  } catch {
    clearServiceOpsSessionCookies(cookieStore);
    return false;
  }
}

export async function logoutServiceOpsSessionCookies(
  cookieStore: ServiceOpsSessionCookieStore,
  { configured, createClient }: ServiceOpsLogoutOptions
): Promise<void> {
  const { accessToken } = readServiceOpsSessionTokens(cookieStore);

  try {
    if (configured && accessToken) {
      await createClient(accessToken).logout();
    }
  } catch {
    // Local cookie cleanup is the source of truth for browser logout. Backend logout failures
    // should not leave an operator stuck with stale HTTP-only cookies.
  } finally {
    clearServiceOpsSessionCookies(cookieStore);
  }
}

function serviceOpsCookieOptions(expiresAt: string, secure: boolean): ServiceOpsSessionCookieOptions {
  return {
    expires: parseCookieExpires(expiresAt),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure
  };
}

function parseCookieExpires(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(Date.now() + 30 * 60 * 1000) : parsed;
}
