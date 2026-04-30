import type { RiderInsuranceCreateInput, RiderInsuranceUpdateInput } from "./service-ops-api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InsuranceCommandPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsuranceCommandPayloadError";
  }
}

export function toRiderInsuranceCreatePayload(formData: FormData): RiderInsuranceCreateInput {
  return {
    enabled: toEnabled(formData.get("enabled"), true),
    insuranceItemId: requiredUuid(formData.get("insuranceItemSelection"), "Insurance item selection is required."),
    memo: optionalText(formData.get("memo")),
    riderId: requiredUuid(formData.get("riderSelection"), "Rider selection is required.")
  };
}

export function toRiderInsuranceUpdatePayload(formData: FormData): RiderInsuranceUpdateInput {
  return {
    enabled: toEnabled(formData.get("enabled"), true),
    memo: optionalText(formData.get("memo"))
  };
}

function requiredUuid(value: FormDataEntryValue | null, message: string): string {
  const text = requiredText(value, message);
  if (!UUID_PATTERN.test(text)) {
    throw new InsuranceCommandPayloadError("Invalid selector token. Use the provided rider and insurance item selection controls.");
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

  throw new InsuranceCommandPayloadError("Invalid insurance enabled status.");
}

function requiredText(value: FormDataEntryValue | null, message: string): string {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new InsuranceCommandPayloadError(message);
  }

  return text;
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}
