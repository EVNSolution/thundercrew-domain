import type {
  InsuranceItemCreateInput,
  InsuranceItemUpdateInput,
  ServiceOpsInsuranceCategory,
  ServiceOpsInsuranceCoverageType,
  ServiceOpsInsuranceDurationUnit
} from "./service-ops-api";

export class InsuranceItemCommandPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsuranceItemCommandPayloadError";
  }
}

const COVERAGE_VALUES: ReadonlySet<ServiceOpsInsuranceCoverageType> = new Set([
  "GENERAL_PAID_TRANSPORT",
  "LIABILITY_PAID_TRANSPORT",
  "HOURLY",
  "ONE_DAY",
  "OTHER"
]);

const DURATION_UNIT_VALUES: ReadonlySet<ServiceOpsInsuranceDurationUnit> = new Set([
  "HOUR",
  "DAY",
  "WEEK",
  "MONTH",
  "QUARTER",
  "HALF_YEAR",
  "YEAR"
]);

export function toInsuranceItemCreatePayload(formData: FormData): InsuranceItemCreateInput {
  return {
    name: requiredText(formData.get("name"), "Insurance item name is required."),
    description: optionalText(formData.get("description")),
    enabled: toEnabled(formData.get("enabled"), true),
    ...parseClassificationFields(formData)
  };
}

export function toInsuranceItemUpdatePayload(formData: FormData): InsuranceItemUpdateInput {
  return {
    name: requiredText(formData.get("name"), "Insurance item name is required."),
    description: clearableText(formData.get("description")),
    enabled: toEnabled(formData.get("enabled"), true),
    ...parseClassificationFields(formData)
  };
}

/**
 * Parse the new Slice B fields. Each field is optional individually, but
 * `defaultDurationUnit` and `defaultDurationValue` must come together — the
 * backend service-layer rule (\\`InsuranceItemCommandService\\`) enforces the
 * same invariant. Returning a partial object lets the legacy create payload
 * (name + description + enabled only) keep flowing untouched.
 */
function parseClassificationFields(formData: FormData): Partial<InsuranceItemCreateInput> {
  const partial: Partial<InsuranceItemCreateInput> = {};

  const categoryRaw = String(formData.get("category") ?? "").trim().toUpperCase();
  if (categoryRaw) {
    if (categoryRaw !== "PRIMARY" && categoryRaw !== "ADDON") {
      throw new InsuranceItemCommandPayloadError("Invalid insurance category.");
    }
    partial.category = categoryRaw as ServiceOpsInsuranceCategory;
  }

  const coverageRaw = String(formData.get("coverageType") ?? "").trim().toUpperCase();
  if (coverageRaw) {
    if (!COVERAGE_VALUES.has(coverageRaw as ServiceOpsInsuranceCoverageType)) {
      throw new InsuranceItemCommandPayloadError("Invalid insurance coverage type.");
    }
    partial.coverageType = coverageRaw as ServiceOpsInsuranceCoverageType;
  }

  const durationUnitRaw = String(formData.get("defaultDurationUnit") ?? "").trim().toUpperCase();
  const durationValueRaw = String(formData.get("defaultDurationValue") ?? "").trim();
  const hasUnit = durationUnitRaw.length > 0;
  const hasValue = durationValueRaw.length > 0;

  if (hasUnit !== hasValue) {
    throw new InsuranceItemCommandPayloadError(
      "defaultDurationUnit and defaultDurationValue must be supplied together."
    );
  }

  if (hasUnit) {
    if (!DURATION_UNIT_VALUES.has(durationUnitRaw as ServiceOpsInsuranceDurationUnit)) {
      throw new InsuranceItemCommandPayloadError("Invalid insurance duration unit.");
    }
    if (!/^\d+$/.test(durationValueRaw)) {
      throw new InsuranceItemCommandPayloadError(
        "defaultDurationValue must be a non-negative integer."
      );
    }
    const value = Number(durationValueRaw);
    if (value <= 0) {
      throw new InsuranceItemCommandPayloadError("defaultDurationValue must be greater than zero.");
    }
    partial.defaultDurationUnit = durationUnitRaw as ServiceOpsInsuranceDurationUnit;
    partial.defaultDurationValue = value;
  }

  return partial;
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
