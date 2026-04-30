import {
  type FrontendVehicle,
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import {
  bikeDeviceInstallations as mockBikeDeviceInstallations,
  devices as mockDevices,
  vehicles as mockVehicles
} from "@/lib/services/mock-data";
import type { Device } from "@/types/domain";
import {
  type BikeDeviceInstallationDetailResult,
  type DeviceDataResult,
  type DeviceDetailResult,
  type DeviceFormOptions,
  type DeviceLookup,
  deviceLabel,
  isUuidLike,
  mockBikeDeviceInstallationDetail,
  mockBikeDeviceInstallationUnavailableServiceDetail,
  mockDeviceData,
  mockDeviceDetail,
  mockDeviceFormOptions,
  mockDeviceUnavailableServiceDetail,
  toDeviceList,
  toFrontendBikeDeviceInstallation
} from "@/lib/services/device-data-core";

export async function loadDeviceData(): Promise<DeviceDataResult> {
  const fallback = mockDeviceData(mockDevices, mockBikeDeviceInstallations);

  if (!serviceOpsApiConfigured()) {
    return {
      ...fallback,
      notice: "SERVICE_OPS_API_BASE_URL이 없어 mock 단말 데이터를 표시합니다. 백엔드 연결 시 서버 액션이 실제 API를 호출합니다."
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      ...fallback,
      notice: "서비스 API 세션 쿠키가 없어 mock 단말 데이터를 표시합니다. 관리자 로그인 후 실제 백엔드 목록으로 전환됩니다."
    };
  }

  try {
    const [devicesPage, installationsPage, vehiclesPage] = await Promise.all([
      client.listDevices({ page: 0, size: 100 }),
      client.listBikeDeviceInstallations({ page: 0, size: 100 }),
      client.listVehicles({ page: 0, size: 100 })
    ]);
    const devices = toDeviceList(devicesPage.items);
    const lookup = toDeviceLookup(vehiclesPage.items, devices);

    return {
      devices,
      installations: installationsPage.items.map((installation) => toFrontendBikeDeviceInstallation(installation, lookup)),
      source: "service-ops"
    };
  } catch (error) {
    return {
      ...fallback,
      notice: `서비스 API 단말 조회 실패로 mock 단말 데이터를 표시합니다.${formatServiceOpsError(error)}`
    };
  }
}

export async function loadDeviceDetail(slug: string): Promise<DeviceDetailResult | null> {
  const fallback = mockDeviceDetail(slug, mockDevices);

  if (!serviceOpsApiConfigured() && isUuidLike(slug)) {
    return mockDeviceUnavailableServiceDetail(
      slug,
      mockDevices,
      "SERVICE_OPS_API_BASE_URL이 없어 mock 단말 상세를 표시합니다. 백엔드 연결 후 실제 단말 상세로 전환됩니다."
    );
  }

  if (serviceOpsApiConfigured() && isUuidLike(slug)) {
    const client = await createAuthenticatedServiceOpsApiClient();

    if (!client) {
      return mockDeviceUnavailableServiceDetail(
        slug,
        mockDevices,
        "서비스 API 세션 쿠키가 없어 mock 단말 상세를 표시합니다. 관리자 로그인 후 실제 백엔드 상세로 전환됩니다."
      );
    }

    try {
      const device = await client.getDevice(slug);
      return { device: toDeviceList([device])[0], source: "service-ops" };
    } catch (error) {
      return mockDeviceUnavailableServiceDetail(
        slug,
        mockDevices,
        `서비스 API 단말 상세 조회 실패로 mock 단말 데이터를 표시합니다.${formatServiceOpsError(error)}`
      );
    }
  }

  return fallback;
}

export async function loadBikeDeviceInstallationDetail(slug: string): Promise<BikeDeviceInstallationDetailResult | null> {
  const fallback = mockBikeDeviceInstallationDetail(slug, mockBikeDeviceInstallations);

  if (!serviceOpsApiConfigured() && isUuidLike(slug)) {
    return mockBikeDeviceInstallationUnavailableServiceDetail(
      slug,
      mockBikeDeviceInstallations,
      "SERVICE_OPS_API_BASE_URL이 없어 mock 설치 상세를 표시합니다. 백엔드 연결 후 실제 설치 상세로 전환됩니다."
    );
  }

  if (serviceOpsApiConfigured() && isUuidLike(slug)) {
    const client = await createAuthenticatedServiceOpsApiClient();

    if (!client) {
      return mockBikeDeviceInstallationUnavailableServiceDetail(
        slug,
        mockBikeDeviceInstallations,
        "서비스 API 세션 쿠키가 없어 mock 설치 상세를 표시합니다. 관리자 로그인 후 실제 백엔드 상세로 전환됩니다."
      );
    }

    try {
      const [installation, devicesPage, vehiclesPage] = await Promise.all([
        client.getBikeDeviceInstallation(slug),
        client.listDevices({ page: 0, size: 100 }),
        client.listVehicles({ page: 0, size: 100 })
      ]);
      const devices = toDeviceList(devicesPage.items);
      const lookup = toDeviceLookup(vehiclesPage.items, devices);
      return { installation: toFrontendBikeDeviceInstallation(installation, lookup), source: "service-ops" };
    } catch (error) {
      return mockBikeDeviceInstallationUnavailableServiceDetail(
        slug,
        mockBikeDeviceInstallations,
        `서비스 API 설치 상세 조회 실패로 mock 설치 데이터를 표시합니다.${formatServiceOpsError(error)}`
      );
    }
  }

  return fallback;
}

export async function loadDeviceFormOptions(): Promise<DeviceFormOptions> {
  const fallback = mockDeviceFormOptions(mockVehicles, mockDevices);

  if (!serviceOpsApiConfigured()) {
    return mockDeviceFormOptions(
      mockVehicles,
      mockDevices,
      "SERVICE_OPS_API_BASE_URL이 없어 mock 차량/단말 선택지를 표시합니다."
    );
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return mockDeviceFormOptions(
      mockVehicles,
      mockDevices,
      "서비스 API 세션 쿠키가 없어 mock 차량/단말 선택지를 표시합니다."
    );
  }

  try {
    const [vehiclesPage, devicesPage] = await Promise.all([
      client.listVehicles({ page: 0, size: 100 }),
      client.listDevices({ page: 0, size: 100 })
    ]);
    return {
      devices: toDeviceList(devicesPage.items).filter((device) => device.enabled),
      source: "service-ops",
      vehicles: vehiclesPage.items
    };
  } catch (error) {
    return mockDeviceFormOptions(
      mockVehicles,
      mockDevices,
      `서비스 API 선택지 조회 실패로 mock 선택지를 표시합니다.${formatServiceOpsError(error)}`
    );
  }
}

function toDeviceLookup(
  vehicles: FrontendVehicle[],
  devices: Device[]
): DeviceLookup {
  return {
    devices: new Map(devices.map((device) => [device.id ?? device.slug, { deviceUid: device.deviceUid, label: deviceLabel(device) }])),
    vehicles: new Map(vehicles.map((vehicle) => [vehicle.id ?? vehicle.slug, { model: vehicle.model, plateNumber: vehicle.plateNumber, status: vehicle.status }]))
  };
}

function formatServiceOpsError(error: unknown): string {
  const serviceError = error as Partial<ServiceOpsApiError>;
  if (serviceError?.status) {
    return ` (${serviceError.status}${serviceError.code ? `/${serviceError.code}` : ""})`;
  }

  return "";
}
