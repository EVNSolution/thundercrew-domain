"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type RiderCreateInput,
  type RiderEducationRecordCreateInput,
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
  const educationPayload = toInitialEducationPayload(rider.id ?? rider.slug, formData);
  let educationOutcome: "none" | "created" | "failed" = "none";
  if (educationPayload) {
    try {
      await client.createRiderEducationRecord(educationPayload);
      educationOutcome = "created";
    } catch {
      educationOutcome = "failed";
    }
  }

  revalidatePath("/riders");
  const status = createdStatusFor(educationOutcome);
  redirect(`/riders/${rider.slug}?status=${status}`);
}

function createdStatusFor(outcome: "none" | "created" | "failed"): string {
  if (outcome === "created") return "created-with-education";
  if (outcome === "failed") return "created-education-failed";
  return "created";
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
