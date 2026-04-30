import type {
  RiderBikeContractCreateInput,
  RiderBikeContractTerminateInput,
  RiderBikeContractUpdateInput
} from "./service-ops-api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEOUL_OFFSET = "+09:00";

export class ContractCommandPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractCommandPayloadError";
  }
}

export function toRiderBikeContractCreatePayload(formData: FormData): RiderBikeContractCreateInput {
  return {
    bikeId: requiredUuid(formData.get("bikeSelection"), "Vehicle selection is required."),
    contractTemplateId: requiredUuid(formData.get("contractTemplateSelection"), "Contract template selection is required."),
    memo: optionalText(formData.get("memo")),
    riderId: requiredUuid(formData.get("riderSelection"), "Rider selection is required."),
    startAt: toServiceInstant(formData.get("startAt"), "Contract start date/time is required.")
  };
}

export function toRiderBikeContractMemoPayload(formData: FormData): RiderBikeContractUpdateInput {
  return {
    memo: optionalText(formData.get("memo"))
  };
}

export function toRiderBikeContractTerminatePayload(formData: FormData): RiderBikeContractTerminateInput {
  return {
    terminatedAt: toServiceInstant(formData.get("terminatedAt"), "Contract termination date/time is required."),
    terminatedReason: optionalText(formData.get("terminatedReason"))
  };
}

function requiredUuid(value: FormDataEntryValue | null, message: string): string {
  const text = requiredText(value, message);
  if (!UUID_PATTERN.test(text)) {
    throw new ContractCommandPayloadError("Invalid selector token. Use the provided rider, vehicle, and contract template selection controls.");
  }

  return text;
}

function toServiceInstant(value: FormDataEntryValue | null, message: string): string {
  const text = requiredText(value, message);
  const normalized = normalizeDateTimeInput(text);
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new ContractCommandPayloadError("Invalid contract date/time.");
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

function requiredText(value: FormDataEntryValue | null, message: string): string {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new ContractCommandPayloadError(message);
  }

  return text;
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}
