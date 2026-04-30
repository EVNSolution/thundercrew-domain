import type {
  BikeDeviceInstallationCreateInput,
  BikeDeviceInstallationRemoveInput,
  DeviceCreateInput,
  DeviceUpdateInput
} from "./service-ops-api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEOUL_OFFSET = "+09:00";

export class DeviceCommandPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeviceCommandPayloadError";
  }
}

export function toDeviceCreatePayload(formData: FormData): DeviceCreateInput {
  return {
    deviceUid: requiredText(formData.get("deviceUid"), "Device UID is required."),
    enabled: toEnabled(formData.get("enabled"), true),
    manufacturer: optionalText(formData.get("manufacturer")),
    memo: optionalText(formData.get("memo")),
    modelName: optionalText(formData.get("modelName"))
  };
}

export function toDeviceUpdatePayload(formData: FormData): DeviceUpdateInput {
  return {
    deviceUid: requiredText(formData.get("deviceUid"), "Device UID is required."),
    enabled: toEnabled(formData.get("enabled"), true),
    manufacturer: clearableText(formData.get("manufacturer")),
    memo: clearableText(formData.get("memo")),
    modelName: clearableText(formData.get("modelName"))
  };
}

export function toBikeDeviceInstallationCreatePayload(formData: FormData): BikeDeviceInstallationCreateInput {
  return {
    bikeId: requiredUuid(formData.get("vehicleSelection"), "Vehicle selection is required."),
    deviceId: requiredUuid(formData.get("deviceSelection"), "Device selection is required."),
    installedAt: toServiceInstant(formData.get("installedAt"), "Installed date/time is required."),
    memo: optionalText(formData.get("memo"))
  };
}

export function toBikeDeviceInstallationRemovePayload(formData: FormData): BikeDeviceInstallationRemoveInput {
  return {
    memo: clearableText(formData.get("memo")),
    removedAt: toOptionalServiceInstant(formData.get("removedAt"))
  };
}

function requiredUuid(value: FormDataEntryValue | null, message: string): string {
  const text = requiredText(value, message);
  if (!UUID_PATTERN.test(text)) {
    throw new DeviceCommandPayloadError("Invalid selector token. Use the provided vehicle and device selection controls.");
  }

  return text;
}

function toEnabled(value: FormDataEntryValue | null, fallback: boolean): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) {
    return fallback;
  }

  if (["true", "1", "on", "enabled"].includes(text)) {
    return true;
  }

  if (["false", "0", "off", "disabled"].includes(text)) {
    return false;
  }

  throw new DeviceCommandPayloadError("Invalid enabled status.");
}

function toOptionalServiceInstant(value: FormDataEntryValue | null): string | null {
  const text = optionalText(value);
  if (!text) {
    return null;
  }

  return toServiceInstant(text, "Removal date/time is required.");
}

function toServiceInstant(value: FormDataEntryValue | string | null, message: string): string {
  const text = requiredText(value, message);
  const normalized = normalizeDateTimeInput(text);
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new DeviceCommandPayloadError("Invalid device date/time.");
  }

  return date.toISOString();
}

function normalizeDateTimeInput(value: string): string {
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00${SEOUL_OFFSET}`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${value}:00${SEOUL_OFFSET}`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) {
    return `${value}${SEOUL_OFFSET}`;
  }

  return value;
}

function requiredText(value: FormDataEntryValue | string | null, message: string): string {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new DeviceCommandPayloadError(message);
  }

  return text;
}

function optionalText(value: FormDataEntryValue | string | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function clearableText(value: FormDataEntryValue | string | null): string | null {
  if (value === null) {
    return null;
  }

  return String(value).trim();
}
