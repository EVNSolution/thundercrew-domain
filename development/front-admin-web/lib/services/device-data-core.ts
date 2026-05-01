import type { BikeDeviceInstallation, Device, Vehicle } from "@/types/domain";
import type { ServiceOpsBikeDeviceInstallation, ServiceOpsDevice } from "./service-ops-api";

export type DeviceLookup = {
  devices: Map<string, { deviceUid: string; label: string }>;
  vehicles: Map<string, { model: string; plateNumber: string; status: Vehicle["status"] }>;
};

export type DeviceDataResult = {
  devices: Device[];
  installations: BikeDeviceInstallation[];
  notice?: string;
  source: "mock" | "service-ops";
};

export type DeviceDetailResult = {
  device: Device;
  notice?: string;
  source: "mock" | "service-ops";
};

export type BikeDeviceInstallationDetailResult = {
  installation: BikeDeviceInstallation;
  notice?: string;
  source: "mock" | "service-ops";
};

export type DeviceFormOptions = {
  devices: Device[];
  notice?: string;
  source: "mock" | "service-ops";
  vehicles: Array<Pick<Vehicle, "model" | "plateNumber" | "slug" | "status">>;
};

export function toDeviceList(devices: ServiceOpsDevice[]): Device[] {
  return devices.map(toFrontendDeviceModel);
}

export function toFrontendDeviceModel(device: ServiceOpsDevice): Device {
  return {
    createdAt: device.createdAt,
    deviceUid: device.deviceUid,
    enabled: device.enabled,
    id: device.id,
    idx: device.idx,
    manufacturer: device.manufacturer,
    memo: device.memo,
    modelName: device.modelName,
    slug: device.id,
    source: "service-ops",
    updatedAt: device.updatedAt
  };
}

export function toFrontendBikeDeviceInstallation(
  installation: ServiceOpsBikeDeviceInstallation,
  lookup: DeviceLookup
): BikeDeviceInstallation {
  const vehicle = lookup.vehicles.get(installation.bikeId);
  const device = lookup.devices.get(installation.deviceId);
  const removed = Boolean(installation.removedAt);

  return {
    bikeId: installation.bikeId,
    bikeLabel: vehicle ? `${vehicle.plateNumber} · ${vehicle.model}` : "알 수 없는 차량",
    createdAt: installation.createdAt,
    deviceId: installation.deviceId,
    deviceLabel: device?.label ?? "알 수 없는 단말",
    deviceUid: device?.deviceUid,
    id: installation.id,
    idx: installation.idx,
    installedAt: installation.installedAt,
    memo: installation.memo,
    removedAt: installation.removedAt,
    slug: installation.id,
    source: "service-ops",
    status: removed ? "제거됨" : "설치 중",
    updatedAt: installation.updatedAt
  };
}

export function mockDeviceData(devices: Device[], installations: BikeDeviceInstallation[]): DeviceDataResult {
  return {
    devices,
    installations,
    source: "mock"
  };
}

export function mockDeviceDetail(slug: string, devices: Device[]): DeviceDetailResult | null {
  const device = devices.find((item) => item.slug === slug || item.id === slug);
  return device ? { device, source: "mock" } : null;
}

export function mockDeviceUnavailableServiceDetail(slug: string, devices: Device[], notice: string): DeviceDetailResult {
  const fallback = devices[0] ?? {
    deviceUid: "서비스 연결 필요 단말",
    enabled: false,
    manufacturer: "서비스 연결 필요",
    memo: notice,
    modelName: "-",
    slug
  };

  return {
    device: {
      ...fallback,
      id: slug,
      slug,
      source: "mock"
    },
    notice,
    source: "mock"
  };
}

export function mockBikeDeviceInstallationDetail(slug: string, installations: BikeDeviceInstallation[]): BikeDeviceInstallationDetailResult | null {
  const installation = installations.find((item) => item.slug === slug || item.id === slug);
  return installation ? { installation, source: "mock" } : null;
}

export function mockBikeDeviceInstallationUnavailableServiceDetail(
  slug: string,
  installations: BikeDeviceInstallation[],
  notice: string
): BikeDeviceInstallationDetailResult {
  const fallback = installations[0] ?? {
    bikeLabel: "서비스 연결 필요 차량",
    deviceLabel: "서비스 연결 필요 단말",
    installedAt: new Date(0).toISOString(),
    memo: notice,
    slug,
    status: "제거됨" as const
  };

  return {
    installation: {
      ...fallback,
      id: slug,
      slug,
      source: "mock"
    },
    notice,
    source: "mock"
  };
}

export function mockDeviceFormOptions(vehicles: Array<Pick<Vehicle, "model" | "plateNumber" | "slug" | "status">>, devices: Device[], notice?: string): DeviceFormOptions {
  return {
    devices: devices.filter((device) => device.enabled),
    notice,
    source: "mock",
    vehicles
  };
}

export function deviceLabel(device: Device): string {
  return [device.deviceUid, device.modelName].filter(Boolean).join(" · ");
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
