import type {
  BikeEquipmentCreateInput,
  BikeEquipmentRemoveInput,
  BikeEquipmentUpdateInput,
  EquipmentTypeCreateInput,
  EquipmentTypeUpdateInput
} from "./service-ops-api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEOUL_OFFSET = "+09:00";

export class EquipmentCommandPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EquipmentCommandPayloadError";
  }
}

export function toEquipmentTypeCreatePayload(formData: FormData): EquipmentTypeCreateInput {
  return {
    description: optionalText(formData.get("description")),
    enabled: toEnabled(formData.get("enabled"), true),
    name: requiredText(formData.get("name"), "Equipment type name is required.")
  };
}

export function toEquipmentTypeUpdatePayload(formData: FormData): EquipmentTypeUpdateInput {
  return {
    description: clearableText(formData.get("description")),
    enabled: toEnabled(formData.get("enabled"), true),
    name: requiredText(formData.get("name"), "Equipment type name is required.")
  };
}

export function toBikeEquipmentCreatePayload(formData: FormData): BikeEquipmentCreateInput {
  return {
    bikeId: requiredUuid(formData.get("bikeSelection"), "Vehicle selection is required."),
    equipmentLabel: optionalText(formData.get("equipmentLabel")),
    equipmentTypeId: requiredUuid(formData.get("equipmentTypeSelection"), "Equipment type selection is required."),
    installedAt: toServiceInstant(formData.get("installedAt"), "Installed date/time is required."),
    managementDueDate: toServiceDate(formData.get("managementDueDate"), "Management due date is required."),
    managementNote: optionalText(formData.get("managementNote")),
    memo: optionalText(formData.get("memo")),
    modelName: optionalText(formData.get("modelName")),
    serialNumber: optionalText(formData.get("serialNumber"))
  };
}

export function toBikeEquipmentUpdatePayload(formData: FormData): BikeEquipmentUpdateInput {
  return {
    equipmentLabel: clearableText(formData.get("equipmentLabel")),
    managementDueDate: toOptionalServiceDate(formData.get("managementDueDate")),
    managementNote: clearableText(formData.get("managementNote")),
    memo: clearableText(formData.get("memo")),
    modelName: clearableText(formData.get("modelName")),
    serialNumber: clearableText(formData.get("serialNumber"))
  };
}

export function toBikeEquipmentRemovePayload(formData: FormData): BikeEquipmentRemoveInput {
  return {
    memo: clearableText(formData.get("memo")),
    removedAt: toOptionalServiceInstant(formData.get("removedAt"))
  };
}

function requiredUuid(value: FormDataEntryValue | null, message: string): string {
  const text = requiredText(value, message);
  if (!UUID_PATTERN.test(text)) {
    throw new EquipmentCommandPayloadError("Invalid selector token. Use the provided vehicle and equipment type selection controls.");
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

  throw new EquipmentCommandPayloadError("Invalid enabled status.");
}

function toOptionalServiceDate(value: FormDataEntryValue | null): string | null {
  const text = optionalText(value);
  if (!text) {
    return null;
  }

  return toServiceDate(text, "Management due date is required.");
}

function toServiceDate(value: FormDataEntryValue | string | null, message: string): string {
  const text = requiredText(value, message);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new EquipmentCommandPayloadError("Invalid management due date.");
  }

  return text;
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
    throw new EquipmentCommandPayloadError("Invalid equipment date/time.");
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
    throw new EquipmentCommandPayloadError(message);
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
