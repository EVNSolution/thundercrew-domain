import type {
  ContractTemplateCreateInput,
  ContractTemplateUpdateInput,
  ServiceOpsContractCategory,
  ServiceOpsContractDurationUnit,
  ServiceOpsContractReturnType
} from "./service-ops-api";

export class ContractTemplateCommandPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractTemplateCommandPayloadError";
  }
}

const RENTAL_UNITS: ReadonlySet<ServiceOpsContractDurationUnit> = new Set([
  "DAY",
  "WEEK",
  "MONTH",
  "QUARTER",
  "HALF_YEAR"
]);

export function toContractTemplateCreatePayload(formData: FormData): ContractTemplateCreateInput {
  const base = parseStructuredFields(formData);
  return {
    name: requiredText(formData.get("name"), "Contract template name is required."),
    description: optionalText(formData.get("description")),
    enabled: toEnabled(formData.get("enabled"), true),
    ...base
  };
}

export function toContractTemplateUpdatePayload(formData: FormData): ContractTemplateUpdateInput {
  const base = parseStructuredFields(formData);
  return {
    name: requiredText(formData.get("name"), "Contract template name is required."),
    description: clearableText(formData.get("description")),
    enabled: toEnabled(formData.get("enabled"), true),
    ...base
  };
}

/**
 * Branch on the `category` hidden field set by the form. Each category has
 * its own validation:
 *
 * - SUBSCRIPTION: returnType required, durationUnit forced to MONTH × 12.
 * - RENTAL: returnType + durationUnit (∈ DAY/WEEK/MONTH/QUARTER/HALF_YEAR)
 *           + positive durationValue. includesInsurance optional.
 * - CUSTOM: legacy day/hour/minute payload, optional `unlimited`. structured
 *           fields stay null so the backend keeps the legacy behavior.
 *
 * The backend does its own validation (ServiceOps Slice A) so failed
 * combinations come back as 409 INVALID_STATE_TRANSITION; this mapper just
 * keeps obviously-wrong inputs from reaching the API.
 */
function parseStructuredFields(formData: FormData): Partial<ContractTemplateCreateInput> {
  const categoryRaw = String(formData.get("category") ?? "CUSTOM").trim().toUpperCase();
  const category = categoryRaw as ServiceOpsContractCategory;
  if (category !== "SUBSCRIPTION" && category !== "RENTAL" && category !== "CUSTOM") {
    throw new ContractTemplateCommandPayloadError("Invalid contract template category.");
  }

  if (category === "SUBSCRIPTION") {
    return {
      category: "SUBSCRIPTION",
      returnType: parseReturnType(formData.get("returnType")),
      durationUnit: "MONTH",
      durationValue: 12,
      includesInsurance: parseIncludesInsurance(formData),
      defaultInsuranceItemId: parseDefaultInsuranceItemId(formData),
      durationMinutes: 12 * 30 * 1440
    };
  }

  if (category === "RENTAL") {
    const durationUnit = parseRentalDurationUnit(formData.get("durationUnit"));
    const durationValue = toPositiveInteger(
      formData.get("durationValue"),
      "RENTAL duration value must be a positive integer."
    );
    return {
      category: "RENTAL",
      returnType: parseReturnType(formData.get("returnType")),
      durationUnit,
      durationValue,
      includesInsurance: parseIncludesInsurance(formData),
      defaultInsuranceItemId: parseDefaultInsuranceItemId(formData),
      durationMinutes: estimateRentalDurationMinutes(durationUnit, durationValue)
    };
  }

  // CUSTOM
  return {
    category: "CUSTOM",
    durationMinutes: toCustomDurationMinutes(formData)
  };
}

function parseReturnType(value: FormDataEntryValue | null): ServiceOpsContractReturnType {
  const text = String(value ?? "").trim().toUpperCase();
  if (text === "TAKEOVER" || text === "RETURN") {
    return text;
  }
  throw new ContractTemplateCommandPayloadError("returnType must be TAKEOVER or RETURN.");
}

function parseRentalDurationUnit(value: FormDataEntryValue | null): ServiceOpsContractDurationUnit {
  const text = String(value ?? "").trim().toUpperCase() as ServiceOpsContractDurationUnit;
  if (!RENTAL_UNITS.has(text)) {
    throw new ContractTemplateCommandPayloadError(
      "RENTAL duration unit must be DAY/WEEK/MONTH/QUARTER/HALF_YEAR."
    );
  }
  return text;
}

function parseIncludesInsurance(formData: FormData): boolean {
  // The HTML <input type="checkbox" value="true"> only submits the field when
  // checked. Treat absence as `false`.
  return Boolean(formData.get("includesInsurance"));
}

function parseDefaultInsuranceItemId(formData: FormData): string | null {
  if (!parseIncludesInsurance(formData)) {
    return null;
  }
  const text = String(formData.get("defaultInsuranceItemId") ?? "").trim();
  if (!text) {
    throw new ContractTemplateCommandPayloadError(
      "defaultInsuranceItemId is required when includesInsurance is true."
    );
  }
  return text;
}

function estimateRentalDurationMinutes(
  unit: ServiceOpsContractDurationUnit,
  value: number
): number {
  const minutesPerUnit: Record<ServiceOpsContractDurationUnit, number> = {
    DAY: 1440,
    WEEK: 7 * 1440,
    MONTH: 30 * 1440,
    QUARTER: 90 * 1440,
    HALF_YEAR: 180 * 1440,
    YEAR: 365 * 1440
  };
  return minutesPerUnit[unit] * value;
}

function toCustomDurationMinutes(formData: FormData): number | null {
  const mode = String(formData.get("customDurationMode") ?? "limited").trim();
  if (mode === "unlimited") {
    return null;
  }
  if (mode !== "limited") {
    throw new ContractTemplateCommandPayloadError("Invalid contract template duration mode.");
  }

  const days = toNonNegativeInteger(
    formData.get("customDurationDays"),
    "Duration days must be a non-negative integer."
  );
  const hours = toNonNegativeInteger(
    formData.get("customDurationHours"),
    "Duration hours must be a non-negative integer."
  );
  const minutes = toNonNegativeInteger(
    formData.get("customDurationMinutesPart"),
    "Duration minutes must be a non-negative integer."
  );
  const total = days * 1440 + hours * 60 + minutes;
  if (total <= 0) {
    throw new ContractTemplateCommandPayloadError("Limited contract duration must be greater than zero.");
  }
  return total;
}

function toPositiveInteger(value: FormDataEntryValue | null, message: string): number {
  const n = toNonNegativeInteger(value, message);
  if (n <= 0) {
    throw new ContractTemplateCommandPayloadError(message);
  }
  return n;
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
  if (!text) return fallback;
  if (["true", "1", "on", "enabled"].includes(text)) return true;
  if (["false", "0", "off", "disabled"].includes(text)) return false;
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
