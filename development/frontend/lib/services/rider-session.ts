import { cookies } from "next/headers";

import { type RiderAuthResponse } from "./rider-api";

export const RIDER_ACCESS_TOKEN_COOKIE = "thundercrew_rider_access_token";
export const RIDER_REFRESH_TOKEN_COOKIE = "thundercrew_rider_refresh_token";

function secure(): boolean {
  return process.env.NODE_ENV === "production";
}

function parseExpires(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(Date.now() + 30 * 60 * 1000) : parsed;
}

export async function setRiderSession(auth: RiderAuthResponse): Promise<void> {
  const store = await cookies();
  const common = { httpOnly: true as const, path: "/" as const, sameSite: "lax" as const, secure: secure() };
  store.set(RIDER_ACCESS_TOKEN_COOKIE, auth.accessToken, { ...common, expires: parseExpires(auth.expiresAt) });
  store.set(RIDER_REFRESH_TOKEN_COOKIE, auth.refreshToken, { ...common, expires: parseExpires(auth.refreshExpiresAt) });
}

export async function clearRiderSession(): Promise<void> {
  const store = await cookies();
  store.delete(RIDER_ACCESS_TOKEN_COOKIE);
  store.delete(RIDER_REFRESH_TOKEN_COOKIE);
}

export async function getRiderAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(RIDER_ACCESS_TOKEN_COOKIE)?.value ?? null;
}
