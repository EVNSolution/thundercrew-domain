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

export async function serviceOpsSessionReady(): Promise<boolean> {
  if (!serviceOpsApiConfigured()) {
    return false;
  }

  const cookieStore = await cookies();
  const { accessToken, refreshToken } = readServiceOpsSessionTokens(cookieStore);
  return Boolean(accessToken || refreshToken);
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
