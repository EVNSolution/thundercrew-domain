"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type RiderBikeContractCreateInput,
  type RiderCreateInput,
  type RiderEducationRecordCreateInput,
  type RiderInsuranceCreateInput,
  type ServiceOpsRiderEducationType,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export async function createRiderAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/riders?status=mock-saved");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let rider;
  try {
    rider = await client.createRider(toRiderPayload(formData));
  } catch {
    redirect("/riders/new?status=save-error");
  }

  // Slice ④-1b: optional initial education record. Both educationType and
  // completedAt must be supplied; otherwise we treat the section as
  // intentionally skipped. A failure here does NOT roll the rider back —
  // the rider already exists, so the operator can retry from the rider
  // detail page using the dedicated education form.
  const riderId = rider.id ?? rider.slug;
  const educationPayload = toInitialEducationPayload(riderId, formData);
  let educationOutcome: SidecarOutcome = "none";
  if (educationPayload) {
    try {
      await client.createRiderEducationRecord(educationPayload);
      educationOutcome = "created";
    } catch {
      educationOutcome = "failed";
    }
  }

  // Slice ④-1c: optional initial rider-insurance link. Same fail-soft
  // contract as the education sidecar — a failed insurance link does not
  // roll back the rider (or the education record).
  const insurancePayload = toInitialInsurancePayload(riderId, formData);
  let insuranceOutcome: SidecarOutcome = "none";
  if (insurancePayload) {
    try {
      await client.createRiderInsurance(insurancePayload);
      insuranceOutcome = "created";
    } catch {
      insuranceOutcome = "failed";
    }
  }

  // Slice ④-1d: optional initial rider-bike contract (= vehicle matching).
  // Mirrors the insurance sidecar: vehicle + template + start date all
  // required, otherwise we treat the section as skipped. Fail-soft — a
  // failed contract create does not roll back the rider, education or
  // insurance rows the action already produced.
  const contractPayload = toInitialContractPayload(riderId, formData);
  let contractOutcome: SidecarOutcome = "none";
  if (contractPayload) {
    try {
      await client.createRiderBikeContract(contractPayload);
      contractOutcome = "created";
    } catch {
      contractOutcome = "failed";
    }
  }

  revalidatePath("/riders");
  const status = createdStatusFor(educationOutcome, insuranceOutcome, contractOutcome);
  redirect(`/riders/${rider.slug}?status=${status}`);
}

type SidecarOutcome = "none" | "created" | "failed";

function createdStatusFor(
  education: SidecarOutcome,
  insurance: SidecarOutcome,
  contract: SidecarOutcome
): string {
  // Compact status code: e=education state, i=insurance state, c=contract
  // state, each one of ok/fail/skip. The detail page resolves the code
  // into a Korean message. Keeping the codes short keeps the URL readable
  // in dev tooling and analytics.
  if (education === "none" && insurance === "none" && contract === "none") return "created";
  return `created-x-e${shortCode(education)}-i${shortCode(insurance)}-c${shortCode(contract)}`;
}

function shortCode(outcome: SidecarOutcome): string {
  if (outcome === "created") return "ok";
  if (outcome === "failed") return "fail";
  return "skip";
}

function toInitialEducationPayload(
  riderId: string,
  formData: FormData
): RiderEducationRecordCreateInput | null {
  const educationTypeRaw = String(formData.get("initialEducationType") ?? "").trim();
  const completedAtIso = toIsoTimestamp(formData.get("initialEducationCompletedAt"));
  if (!educationTypeRaw || !completedAtIso) {
    // Operator left the optional section empty — skip cleanly.
    return null;
  }
  if (educationTypeRaw !== "ONLINE" && educationTypeRaw !== "OFFLINE") {
    return null;
  }
  return {
    riderId,
    educationType: educationTypeRaw as ServiceOpsRiderEducationType,
    courseName: optionalText(formData.get("initialEducationCourseName")),
    completedAt: completedAtIso,
    expiresAt: toIsoTimestamp(formData.get("initialEducationExpiresAt")) ?? null,
    certificateNo: optionalText(formData.get("initialEducationCertificateNo")),
    issuingAuthority: optionalText(formData.get("initialEducationIssuingAuthority")),
    evidenceUrl: null,
    memo: null
  };
}

function toInitialInsurancePayload(
  riderId: string,
  formData: FormData
): RiderInsuranceCreateInput | null {
  const insuranceItemId = String(formData.get("initialInsuranceItemId") ?? "").trim();
  if (!insuranceItemId) {
    return null;
  }
  return {
    riderId,
    insuranceItemId,
    memo: optionalText(formData.get("initialInsuranceMemo")),
    enabled: true,
    startsAt: toIsoTimestamp(formData.get("initialInsuranceStartsAt")) ?? null,
    endsAt: toIsoTimestamp(formData.get("initialInsuranceEndsAt")) ?? null,
    riderBikeContractId: null
  };
}

function toInitialContractPayload(
  riderId: string,
  formData: FormData
): RiderBikeContractCreateInput | null {
  const bikeId = String(formData.get("initialContractBikeId") ?? "").trim();
  const contractTemplateId = String(formData.get("initialContractTemplateId") ?? "").trim();
  const startAtIso = toIsoTimestamp(formData.get("initialContractStartAt"));
  if (!bikeId || !contractTemplateId || !startAtIso) {
    // Operator left the optional section partially blank — skip cleanly.
    return null;
  }
  return {
    riderId,
    bikeId,
    contractTemplateId,
    startAt: startAtIso,
    memo: optionalText(formData.get("initialContractMemo"))
  };
}

function toIsoTimestamp(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const [year, month, day] = text.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return date.toISOString();
}

export async function updateRiderAction(riderId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/riders/${riderId}?status=mock-saved`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let rider;
  try {
    rider = await client.updateRider(riderId, toRiderPayload(formData));
  } catch {
    redirect(`/riders/${riderId}/edit?status=save-error`);
  }

  revalidatePath("/riders");
  revalidatePath(`/riders/${rider.slug}`);
  redirect(`/riders/${rider.slug}?status=updated`);
}

export async function deleteRiderAction(riderId: string): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/riders/${riderId}?status=mock-deleted`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteRider(riderId);
  } catch {
    redirect(`/riders/${riderId}?status=delete-error`);
  }

  revalidatePath("/riders");
  redirect("/riders?status=deleted");
}

function toRiderPayload(formData: FormData): RiderCreateInput {
  return {
    areaName: optionalText(formData.get("areaName")),
    memo: optionalText(formData.get("memo")),
    name: requiredText(formData.get("name")),
    phoneNumber: requiredText(formData.get("phoneNumber")),
    teamName: optionalText(formData.get("teamName"))
  };
}

function requiredText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = requiredText(value);
  return text ? text : null;
}
