// 라이더 웹앱(P0) 전용 자기완결형 API 클라이언트. admin service-ops-api 와 분리해
// 결합도를 낮춘다. 서버 사이드(server action/component)에서만 호출.

const RIDER_API_PREFIX = "/api/v1";

function baseUrl(): string | null {
  const raw = (process.env.SERVICE_OPS_API_BASE_URL ?? "").trim();
  if (!raw || raw.includes("<") || raw.includes(">")) return null;
  try {
    return new URL(raw).toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function riderApiConfigured(): boolean {
  return baseUrl() !== null;
}

export class RiderApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "RiderApiError";
    this.status = status;
    this.code = code;
  }
}

export type RiderAuthResponse = {
  tokenType: string;
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  rider: { id: string; name: string; phoneNumber: string };
};

export type RiderMe = {
  id: string;
  name: string;
  phoneNumber: string;
  teamName: string | null;
  areaName: string | null;
  activeBikeId: string | null;
};

async function call<T>(path: string, init: RequestInit, accessToken?: string): Promise<T> {
  const base = baseUrl();
  if (!base) {
    throw new RiderApiError("SERVICE_OPS_API_BASE_URL is not configured.", 0, "RIDER_API_NOT_CONFIGURED");
  }
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }
  const response = await fetch(`${base}${RIDER_API_PREFIX}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    let code: string | undefined;
    try {
      const body = (await response.json()) as { code?: string };
      code = body.code;
    } catch {
      // 본문 파싱 실패는 무시
    }
    throw new RiderApiError(`Rider API ${path} failed (${response.status}).`, response.status, code);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function riderLogin(phoneNumber: string, password: string): Promise<RiderAuthResponse> {
  return call<RiderAuthResponse>("/rider-auth/login", {
    method: "POST",
    body: JSON.stringify({ phoneNumber, password })
  });
}

export function riderRefresh(refreshToken: string): Promise<RiderAuthResponse> {
  return call<RiderAuthResponse>("/rider-auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken })
  });
}

export function riderLogout(accessToken: string): Promise<void> {
  return call<void>("/rider-auth/logout", { method: "POST" }, accessToken);
}

export function riderGetMe(accessToken: string): Promise<RiderMe> {
  return call<RiderMe>("/rider/me", { method: "GET" }, accessToken);
}

export type RiderDispatchOrder = {
  id: string;
  bikeId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  latitude: number;
  longitude: number;
  originAddress: string | null;
  originLatitude: number | null;
  originLongitude: number | null;
  sequence: number;
  status: string;
  kind: string; // "PICKUP" | "DELIVERY"
};

export type RiderVehicle = {
  bikeId: string;
  plateNumber: string;
  imei: string | null;
  serviceType: string;
  currentLatitude: number | null;
  currentLongitude: number | null;
  odometerKm: number | null;
  connectionStatus: string | null;
  lastReceivedAt: string | null;
};

export function riderGetDispatchOrders(accessToken: string): Promise<RiderDispatchOrder[]> {
  return call<RiderDispatchOrder[]>("/rider/me/dispatch-orders", { method: "GET" }, accessToken);
}

export async function riderGetVehicle(accessToken: string): Promise<RiderVehicle | null> {
  try {
    return await call<RiderVehicle>("/rider/me/vehicle", { method: "GET" }, accessToken);
  } catch (e) {
    if (e instanceof RiderApiError && e.status === 404) return null;
    throw e;
  }
}
