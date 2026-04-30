import type { ContractTemplateCreateInput, ContractTemplateUpdateInput } from "./service-ops-api";

export class ContractTemplateCommandPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractTemplateCommandPayloadError";
  }
}

export function toContractTemplateCreatePayload(formData: FormData): ContractTemplateCreateInput {
  return {
    description: optionalText(formData.get("description")),
    durationMinutes: toDurationMinutes(formData),
    enabled: toEnabled(formData.get("enabled"), true),
    name: requiredText(formData.get("name"), "Contract template name is required.")
  };
}

export function toContractTemplateUpdatePayload(formData: FormData): ContractTemplateUpdateInput {
  return {
    description: clearableText(formData.get("description")),
    durationMinutes: toDurationMinutes(formData),
    enabled: toEnabled(formData.get("enabled"), true),
    name: requiredText(formData.get("name"), "Contract template name is required.")
  };
}

function toDurationMinutes(formData: FormData): number | null {
  const mode = String(formData.get("durationMode") ?? "limited").trim();
  if (mode === "unlimited") {
    return null;
  }

  if (mode !== "limited") {
    throw new ContractTemplateCommandPayloadError("Invalid contract template duration mode.");
  }

  const days = toNonNegativeInteger(formData.get("durationDays"), "Duration days must be a non-negative integer.");
  const hours = toNonNegativeInteger(formData.get("durationHours"), "Duration hours must be a non-negative integer.");
  const minutes = toNonNegativeInteger(formData.get("durationMinutesPart"), "Duration minutes must be a non-negative integer.");
  const total = (days * 1440) + (hours * 60) + minutes;

  if (total <= 0) {
    throw new ContractTemplateCommandPayloadError("Limited contract duration must be greater than zero.");
  }

  return total;
}

function toNonNegativeInteger(value: FormDataEntryValue | null, message: string): number {
  const text = String(value ?? "").trim();
  if (!text) {
    return 0;
  }

  if (!/^\d+$/.test(text)) {
    throw new ContractTemplateCommandPayloadError(message);
  }

  return Number(text);
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

  throw new ContractTemplateCommandPayloadError("Invalid enabled status.");
}

function requiredText(value: FormDataEntryValue | null, message: string): string {
  const text = optionalText(value);
  if (!text) {
    throw new ContractTemplateCommandPayloadError(message);
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
