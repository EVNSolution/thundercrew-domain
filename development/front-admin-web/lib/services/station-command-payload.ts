import type {
  BatteryStationCountUpdateInput,
  BatteryStationCreateInput,
  BatteryStationUpdateInput,
  ServiceOpsStationStatus
} from "./service-ops-api";

const STATION_STATUS_VALUES = ["ACTIVE", "MAINTENANCE", "INACTIVE"] as const;

export class StationCommandPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StationCommandPayloadError";
  }
}

export function toBatteryStationCreatePayload(formData: FormData): BatteryStationCreateInput {
  return validateBatteryCounts({
    address: requiredText(formData.get("address"), "Station address is required."),
    availableBatteryCount: nonNegativeInteger(formData.get("availableBatteryCount"), "Available battery count is required."),
    currentBatteryCount: nonNegativeInteger(formData.get("currentBatteryCount"), "Current battery count is required."),
    latitude: coordinateNumber(formData.get("latitude"), -90, 90, "Latitude is required."),
    longitude: coordinateNumber(formData.get("longitude"), -180, 180, "Longitude is required."),
    maxBatteryCapacity: nonNegativeInteger(formData.get("maxBatteryCapacity"), "Max battery capacity is required."),
    memo: optionalText(formData.get("memo")),
    name: requiredText(formData.get("name"), "Station name is required."),
    status: toStationStatus(formData.get("status"))
  });
}

export function toBatteryStationUpdatePayload(formData: FormData): BatteryStationUpdateInput {
  return {
    address: requiredText(formData.get("address"), "Station address is required."),
    latitude: coordinateNumber(formData.get("latitude"), -90, 90, "Latitude is required."),
    longitude: coordinateNumber(formData.get("longitude"), -180, 180, "Longitude is required."),
    memo: optionalText(formData.get("memo")),
    name: requiredText(formData.get("name"), "Station name is required."),
    status: toStationStatus(formData.get("status"))
  };
}

export function toBatteryStationCountPayload(formData: FormData): BatteryStationCountUpdateInput {
  return validateBatteryCounts({
    availableBatteryCount: nonNegativeInteger(formData.get("availableBatteryCount"), "Available battery count is required."),
    currentBatteryCount: nonNegativeInteger(formData.get("currentBatteryCount"), "Current battery count is required."),
    maxBatteryCapacity: nonNegativeInteger(formData.get("maxBatteryCapacity"), "Max battery capacity is required."),
    memo: optionalText(formData.get("memo")),
    reason: optionalText(formData.get("reason"))
  });
}

export function toStationStatus(value: FormDataEntryValue | null): ServiceOpsStationStatus {
  const status = requiredText(value, "Station status is required.");
  if (STATION_STATUS_VALUES.includes(status as ServiceOpsStationStatus)) {
    return status as ServiceOpsStationStatus;
  }

  throw new StationCommandPayloadError("Invalid station status.");
}

function validateBatteryCounts<T extends BatteryStationCountUpdateInput>(payload: T): T {
  if (payload.maxBatteryCapacity < payload.currentBatteryCount) {
    throw new StationCommandPayloadError("Max battery capacity must be greater than or equal to current battery count.");
  }

  if (payload.currentBatteryCount < payload.availableBatteryCount) {
    throw new StationCommandPayloadError("Current battery count must be greater than or equal to available battery count.");
  }

  return payload;
}

function coordinateNumber(value: FormDataEntryValue | null, min: number, max: number, message: string): number {
  const number = numericValue(value, message);
  if (number < min || number > max) {
    throw new StationCommandPayloadError("Station coordinates are outside the supported range.");
  }

  return number;
}

function nonNegativeInteger(value: FormDataEntryValue | null, message: string): number {
  const number = numericValue(value, message);
  if (!Number.isInteger(number) || number < 0) {
    throw new StationCommandPayloadError("Battery counts must be non-negative integers.");
  }

  return number;
}

function numericValue(value: FormDataEntryValue | null, message: string): number {
  const text = requiredText(value, message);
  const number = Number(text);
  if (!Number.isFinite(number)) {
    throw new StationCommandPayloadError("Numeric station value is invalid.");
  }

  return number;
}

function requiredText(value: FormDataEntryValue | null, message: string): string {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new StationCommandPayloadError(message);
  }

  return text;
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}
