"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type RiderBikeContractCreateInput,
  type RiderBikeContractUpdateInput,
  type RiderBikeContractTerminateInput,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export async function createRiderContractAction(
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

  let payload: RiderBikeContractCreateInput;
  try {
    payload = toContractCreatePayload(riderId, formData);
  } catch {
    redirect(`/riders/${riderSlug}/contracts/new?status=validation-error`);
  }

  try {
    await client.createRiderBikeContract(payload);
  } catch {
    redirect(`/riders/${riderSlug}/contracts/new?status=save-error`);
  }

  revalidatePath(`/riders/${riderSlug}`);
  redirect(`/riders/${riderSlug}?status=contract-created`);
}

export async function updateRiderContractAction(
  riderSlug: string,
  contractId: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/riders/${riderSlug}?status=mock-saved`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const payload: RiderBikeContractUpdateInput = {
    memo: optionalText(formData.get("memo"))
  };

  try {
    await client.updateRiderBikeContract(contractId, payload);
  } catch {
    redirect(`/riders/${riderSlug}/contracts/${contractId}/edit?status=save-error`);
  }

  revalidatePath(`/riders/${riderSlug}`);
  redirect(`/riders/${riderSlug}?status=contract-updated`);
}

export async function terminateRiderContractAction(
  riderSlug: string,
  contractId: string
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/riders/${riderSlug}?status=mock-saved`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const payload: RiderBikeContractTerminateInput = {
    terminatedAt: new Date().toISOString()
  };

  try {
    await client.terminateRiderBikeContract(contractId, payload);
  } catch {
    redirect(`/riders/${riderSlug}?status=contract-terminate-error`);
  }

  revalidatePath(`/riders/${riderSlug}`);
  redirect(`/riders/${riderSlug}?status=contract-terminated`);
}

function toContractCreatePayload(
  riderId: string,
  formData: FormData
): RiderBikeContractCreateInput {
  const bikeId = String(formData.get("bikeId") ?? "").trim();
  const contractTemplateId = String(formData.get("contractTemplateId") ?? "").trim();
  const startAtIso = toIsoTimestamp(formData.get("startAt"));
  if (!bikeId || !contractTemplateId || !startAtIso) {
    throw new Error("bikeId, contractTemplateId, startAt are all required");
  }
  return {
    riderId,
    bikeId,
    contractTemplateId,
    startAt: startAtIso,
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
  const [year, month, day] = text.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return date.toISOString();
}
