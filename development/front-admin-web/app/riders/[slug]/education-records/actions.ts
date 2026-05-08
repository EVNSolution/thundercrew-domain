"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type RiderEducationRecordCreateInput,
  type ServiceOpsRiderEducationType,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export async function createRiderEducationRecordAction(
  riderId: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/riders/${riderId}?status=mock-saved`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let payload: RiderEducationRecordCreateInput;
  try {
    payload = toEducationPayload(riderId, formData);
  } catch {
    redirect(`/riders/${riderId}/education-records/new?status=validation-error`);
  }

  try {
    await client.createRiderEducationRecord(payload);
  } catch {
    redirect(`/riders/${riderId}/education-records/new?status=save-error`);
  }

  revalidatePath(`/riders/${riderId}`);
  redirect(`/riders/${riderId}?status=education-created`);
}

export async function deleteRiderEducationRecordAction(
  riderId: string,
  recordId: string
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/riders/${riderId}?status=mock-deleted`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteRiderEducationRecord(recordId);
  } catch {
    redirect(`/riders/${riderId}?status=education-delete-error`);
  }

  revalidatePath(`/riders/${riderId}`);
  redirect(`/riders/${riderId}?status=education-deleted`);
}

function toEducationPayload(riderId: string, formData: FormData): RiderEducationRecordCreateInput {
  const educationType = String(formData.get("educationType") ?? "").trim() as ServiceOpsRiderEducationType;
  if (educationType !== "ONLINE" && educationType !== "OFFLINE") {
    throw new Error("educationType must be ONLINE or OFFLINE");
  }
  const completedAtIso = toIsoTimestamp(formData.get("completedAt"));
  if (!completedAtIso) {
    throw new Error("completedAt is required");
  }
  return {
    riderId,
    educationType,
    courseName: optionalText(formData.get("courseName")),
    completedAt: completedAtIso,
    expiresAt: toIsoTimestamp(formData.get("expiresAt")) ?? null,
    certificateNo: optionalText(formData.get("certificateNo")),
    issuingAuthority: optionalText(formData.get("issuingAuthority")),
    evidenceUrl: optionalText(formData.get("evidenceUrl")),
    memo: optionalText(formData.get("memo"))
  };
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function toIsoTimestamp(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  // The HTML <input type="date"> sends `YYYY-MM-DD`; backend expects an
  // ISO instant. Promote the form value to the start of the day in UTC so
  // operator-entered "completion date" matches the inspector's expectation
  // of a local-day boundary without dragging in client-tz subtleties.
  const [year, month, day] = text.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return date.toISOString();
}
