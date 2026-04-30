import type { InsuranceItemCreateInput, InsuranceItemUpdateInput } from "./service-ops-api";

export class InsuranceItemCommandPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsuranceItemCommandPayloadError";
  }
}

export function toInsuranceItemCreatePayload(formData: FormData): InsuranceItemCreateInput {
  return {
    description: optionalText(formData.get("description")),
    enabled: toEnabled(formData.get("enabled"), true),
    name: requiredText(formData.get("name"), "Insurance item name is required.")
  };
}

export function toInsuranceItemUpdatePayload(formData: FormData): InsuranceItemUpdateInput {
  return {
    description: clearableText(formData.get("description")),
    enabled: toEnabled(formData.get("enabled"), true),
    name: requiredText(formData.get("name"), "Insurance item name is required.")
  };
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

  throw new InsuranceItemCommandPayloadError("Invalid enabled status.");
}

function requiredText(value: FormDataEntryValue | null, message: string): string {
  const text = optionalText(value);
  if (!text) {
    throw new InsuranceItemCommandPayloadError(message);
  }

  return text;
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function clearableText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}
