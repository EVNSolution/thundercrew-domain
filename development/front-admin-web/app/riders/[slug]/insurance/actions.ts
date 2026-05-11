"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type RiderInsuranceCreateInput,
  type RiderInsuranceUpdateInput,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export async function createRiderInsuranceAction(
  riderSlug: string,
  riderId: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/riders/${riderSlug}?status=mock-saved`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let payload: RiderInsuranceCreateInput;
  try {
    payload = toInsuranceCreatePayload(riderId, formData);
  } catch {
    redirect(`/riders/${riderSlug}/insurance/new?status=validation-error`);
  }

  try {
    await client.createRiderInsurance(payload);
  } catch {
    redirect(`/riders/${riderSlug}/insurance/new?status=save-error`);
  }

  revalidatePath(`/riders/${riderSlug}`);
  redirect(`/riders/${riderSlug}?status=insurance-created`);
}

export async function updateRiderInsuranceAction(
  riderSlug: string,
  insuranceId: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/riders/${riderSlug}?status=mock-saved`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const payload: RiderInsuranceUpdateInput = {
    memo: optionalText(formData.get("memo")),
    enabled: String(formData.get("enabled") ?? "").toLowerCase() === "true"
  };

  try {
    await client.updateRiderInsurance(insuranceId, payload);
  } catch {
    redirect(`/riders/${riderSlug}/insurance/${insuranceId}/edit?status=save-error`);
  }

  revalidatePath(`/riders/${riderSlug}`);
  redirect(`/riders/${riderSlug}?status=insurance-updated`);
}

export async function deleteRiderInsuranceAction(
  riderSlug: string,
  insuranceId: string
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/riders/${riderSlug}?status=mock-deleted`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteRiderInsurance(insuranceId);
  } catch {
    redirect(`/riders/${riderSlug}?status=insurance-delete-error`);
  }

  revalidatePath(`/riders/${riderSlug}`);
  redirect(`/riders/${riderSlug}?status=insurance-deleted`);
}

function toInsuranceCreatePayload(
  riderId: string,
  formData: FormData
): RiderInsuranceCreateInput {
  const insuranceItemId = String(formData.get("insuranceItemId") ?? "").trim();
  if (!insuranceItemId) {
    throw new Error("insuranceItemId is required");
  }
  return {
    riderId,
    insuranceItemId,
    memo: optionalText(formData.get("memo")),
    startsAt: toIsoTimestamp(formData.get("startsAt")),
    endsAt: toIsoTimestamp(formData.get("endsAt"))
  };
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
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
