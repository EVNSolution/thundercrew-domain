import { cookies } from "next/headers";

import {
  type ServiceOpsApiClient,
  type ServiceOpsAuthResponse,
  createServiceOpsApiClient,
  serviceOpsApiConfigured
} from "./service-ops-api";

const ACCESS_TOKEN_COOKIE = "thundercrew_ops_access_token";
const REFRESH_TOKEN_COOKIE = "thundercrew_ops_refresh_token";

export async function createAuthenticatedServiceOpsApiClient(): Promise<ServiceOpsApiClient | null> {
  if (!serviceOpsApiConfigured()) {
    return null;
  }

  const accessToken = await getServiceOpsAccessToken();
  if (!accessToken) {
    return null;
  }

  return createServiceOpsApiClient({ accessToken });
}

export async function getServiceOpsAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function serviceOpsSessionReady(): Promise<boolean> {
  return serviceOpsApiConfigured() && Boolean(await getServiceOpsAccessToken());
}

export async function setServiceOpsSession(auth: ServiceOpsAuthResponse): Promise<void> {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set(ACCESS_TOKEN_COOKIE, auth.accessToken, {
    expires: parseCookieExpires(auth.expiresAt),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure
  });
  cookieStore.set(REFRESH_TOKEN_COOKIE, auth.refreshToken, {
    expires: parseCookieExpires(auth.refreshExpiresAt),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure
  });
}

export async function clearServiceOpsSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

function parseCookieExpires(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(Date.now() + 30 * 60 * 1000) : parsed;
}
