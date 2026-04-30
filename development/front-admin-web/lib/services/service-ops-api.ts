export type ServiceOpsFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type ServiceOpsPage<T> = {
  items: T[];
  page: {
    number: number;
    size: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

export type ServiceOpsAdminIdentity = {
  id: string;
  loginId: string;
  email: string | null;
  displayName: string;
  role: string;
};

export type ServiceOpsAuthResponse = {
  tokenType: string;
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  admin: ServiceOpsAdminIdentity;
};

export type ServiceOpsRider = {
  id: string;
  idx: number | null;
  name: string;
  phoneNumber: string;
  teamName: string | null;
  areaName: string | null;
  appAccountLinked: boolean;
  appAccountId: string | null;
  appLinkedAt: string | null;
  appLinkStatus: string;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FrontendRider = {
  slug: string;
  id?: string;
  idx?: number | null;
  name: string;
  phone: string;
  team: string;
  area: string;
  status: "활동" | "대기" | "휴면";
  joinedAt: string;
  appAccountLinked?: boolean;
  appAccountId?: string | null;
  appLinkedAt?: string | null;
  appLinkStatus?: string;
  memo?: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "mock" | "service-ops";
};

export type RiderCreateInput = {
  name: string;
  phoneNumber: string;
  teamName?: string | null;
  areaName?: string | null;
  memo?: string | null;
};

export type RiderUpdateInput = Partial<RiderCreateInput>;

export type ServiceOpsDashboardSummary = {
  totalBikes: number;
  bikePinCount: number;
  onlineBikeCount: number;
  signalLostBikeCount: number;
  parkedOfflineBikeCount: number;
  lowBatteryBikeCount: number;
  activeStationCount: number;
  stationPinCount: number;
  availableBatteryCount: number;
};

export type ServiceOpsDashboardBikePin = {
  bikeId: string;
  bikeIdx: number | null;
  plateNumber: string;
  modelName: string;
  operationStatus: string;
  activeRiderLabel: string | null;
  deviceId: string | null;
  lastReceivedAt: string;
  latitude: number | string;
  longitude: number | string;
  speedKph: number | string | null;
  batteryPercent: number | string | null;
  ignitionStatus: string;
  telemetrySource: string;
  drivingStatus: string;
  connectionStatus: string;
  batteryStatus: string;
  pinLabel: string;
};

export type ServiceOpsDashboardStationPin = {
  stationId: string;
  stationIdx: number | null;
  name: string;
  address: string;
  latitude: number | string;
  longitude: number | string;
  status: string;
  maxBatteryCapacity: number;
  currentBatteryCount: number;
  availableBatteryCount: number;
  availableBatteryLabel: string;
  availableBatteryPercentage: number;
  pinLabel: string;
};

export type ServiceOpsDashboardMapState = {
  generatedAt: string;
  summary: ServiceOpsDashboardSummary;
  bikePins: ServiceOpsDashboardBikePin[];
  stationPins: ServiceOpsDashboardStationPin[];
};

export type FrontendDashboardBikePin = Omit<ServiceOpsDashboardBikePin, "latitude" | "longitude" | "speedKph" | "batteryPercent"> & {
  slug: string;
  latitude: number;
  longitude: number;
  speedKph: number | null;
  batteryPercent: number | null;
};

export type FrontendDashboardStationPin = Omit<ServiceOpsDashboardStationPin, "latitude" | "longitude"> & {
  slug: string;
  latitude: number;
  longitude: number;
};

export type FrontendDashboardMapState = {
  generatedAt: string;
  summary: ServiceOpsDashboardSummary;
  bikePins: FrontendDashboardBikePin[];
  stationPins: FrontendDashboardStationPin[];
};

export type ServiceOpsApiClient = {
  login: (request: { loginId: string; password: string }) => Promise<ServiceOpsAuthResponse>;
  refresh: (request: { refreshToken: string }) => Promise<ServiceOpsAuthResponse>;
  logout: () => Promise<void>;
  getDashboardMapState: () => Promise<FrontendDashboardMapState>;
  listRiders: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<FrontendRider>>;
  getRider: (id: string) => Promise<FrontendRider>;
  createRider: (request: RiderCreateInput) => Promise<FrontendRider>;
  updateRider: (id: string, request: RiderUpdateInput) => Promise<FrontendRider>;
};

type ServiceOpsApiOptions = {
  accessToken?: string | null;
  baseUrl?: string | null;
  fetchImpl?: ServiceOpsFetch;
};

type ApiErrorBody = {
  code?: string;
  message?: string;
  path?: string;
  timestamp?: string;
  fieldViolations?: Array<{ field: string; message: string }>;
};

export class ServiceOpsApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ServiceOpsApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function normalizeServiceOpsBaseUrl(value?: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.includes("<") || trimmed.includes(">")) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function serviceOpsApiBaseUrl(): string | null {
  return normalizeServiceOpsBaseUrl(process.env.SERVICE_OPS_API_BASE_URL);
}

export function serviceOpsApiConfigured(baseUrl = process.env.SERVICE_OPS_API_BASE_URL): boolean {
  return normalizeServiceOpsBaseUrl(baseUrl) !== null;
}

export function createServiceOpsApiClient(options: ServiceOpsApiOptions = {}): ServiceOpsApiClient {
  const baseUrl = normalizeServiceOpsBaseUrl(options.baseUrl ?? process.env.SERVICE_OPS_API_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = options.accessToken;

  async function request<T>(
    path: string,
    init: RequestInit = {},
    query?: Record<string, string | number | undefined>
  ): Promise<T> {
    if (!baseUrl) {
      throw new ServiceOpsApiError("SERVICE_OPS_API_BASE_URL is not configured.", 0, "SERVICE_OPS_API_NOT_CONFIGURED");
    }

    const url = new URL(`${baseUrl}/api/v1${path}`);
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    const headers = new Headers(init.headers);
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    if (accessToken && !headers.has("authorization")) {
      headers.set("authorization", `Bearer ${accessToken}`);
    }

    const response = await fetchImpl(url, {
      ...init,
      cache: "no-store",
      headers
    });
    const responseText = await response.text();
    const body = parseResponseBody(responseText);

    if (!response.ok) {
      const errorBody = isApiErrorBody(body) ? body : undefined;
      throw new ServiceOpsApiError(
        errorBody?.message ?? `Service ops API request failed with status ${response.status}.`,
        response.status,
        errorBody?.code,
        body
      );
    }

    return body as T;
  }

  return {
    login: (loginRequest) =>
      request<ServiceOpsAuthResponse>("/auth/login", {
        body: JSON.stringify(loginRequest),
        method: "POST"
      }),
    refresh: (refreshRequest) =>
      request<ServiceOpsAuthResponse>("/auth/refresh", {
        body: JSON.stringify(refreshRequest),
        method: "POST"
      }),
    logout: async () => {
      await request<void>("/auth/logout", { method: "POST" });
    },
    getDashboardMapState: async () =>
      toFrontendDashboardMapState(await request<ServiceOpsDashboardMapState>("/dashboard/map-state", { method: "GET" })),
    listRiders: async ({ page = 0, size = 20, sort } = {}) => {
      const response = await request<ServiceOpsPage<ServiceOpsRider>>("/riders", { method: "GET" }, { page, size, sort });
      return {
        ...response,
        items: response.items.map(toFrontendRider)
      };
    },
    getRider: async (id) => toFrontendRider(await request<ServiceOpsRider>(`/riders/${encodeURIComponent(id)}`, { method: "GET" })),
    createRider: async (createRequest) =>
      toFrontendRider(
        await request<ServiceOpsRider>("/riders", {
          body: JSON.stringify(createRequest),
          method: "POST"
        })
      ),
    updateRider: async (id, updateRequest) =>
      toFrontendRider(
        await request<ServiceOpsRider>(`/riders/${encodeURIComponent(id)}`, {
          body: JSON.stringify(updateRequest),
          method: "PATCH"
        })
      )
  };
}

export function toFrontendDashboardMapState(mapState: ServiceOpsDashboardMapState): FrontendDashboardMapState {
  return {
    generatedAt: mapState.generatedAt,
    summary: mapState.summary,
    bikePins: mapState.bikePins.map((pin) => ({
      ...pin,
      batteryPercent: toNullableNumber(pin.batteryPercent),
      latitude: toNumber(pin.latitude),
      longitude: toNumber(pin.longitude),
      slug: pin.bikeId,
      speedKph: toNullableNumber(pin.speedKph)
    })),
    stationPins: mapState.stationPins.map((pin) => ({
      ...pin,
      latitude: toNumber(pin.latitude),
      longitude: toNumber(pin.longitude),
      slug: pin.stationId
    }))
  };
}

export function toFrontendRider(rider: ServiceOpsRider): FrontendRider {
  return {
    slug: rider.id,
    id: rider.id,
    idx: rider.idx,
    name: rider.name,
    phone: rider.phoneNumber,
    team: normalizeDisplayText(rider.teamName, "미지정"),
    area: normalizeDisplayText(rider.areaName, "미지정"),
    status: rider.appAccountLinked ? "활동" : "대기",
    joinedAt: toDateOnly(rider.createdAt),
    appAccountLinked: rider.appAccountLinked,
    appAccountId: rider.appAccountId,
    appLinkedAt: rider.appLinkedAt,
    appLinkStatus: rider.appLinkStatus,
    memo: rider.memo,
    createdAt: rider.createdAt,
    updatedAt: rider.updatedAt,
    source: "service-ops"
  };
}

function parseResponseBody(responseText: string): unknown {
  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && ("message" in value || "code" in value);
}

function normalizeDisplayText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return toNumber(value);
}

function toDateOnly(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}
