"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import {
  toRiderInsuranceCreatePayload,
  toRiderInsuranceUpdatePayload
} from "@/lib/services/insurance-command-payload";

export async function createInsuranceAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/insurance?status=mock-saved");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let policy;
  try {
    policy = await client.createRiderInsurance(toRiderInsuranceCreatePayload(formData));
  } catch {
    redirect("/insurance/new?status=save-error");
  }

  revalidatePath("/insurance");
  redirect(`/insurance/${policy.id}?status=created`);
}

export async function updateInsuranceAction(policyId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/insurance/${policyId}?status=mock-updated`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let policy;
  try {
    policy = await client.updateRiderInsurance(policyId, toRiderInsuranceUpdatePayload(formData));
  } catch {
    redirect(`/insurance/${policyId}?status=save-error`);
  }

  revalidatePath("/insurance");
  revalidatePath(`/insurance/${policy.id}`);
  redirect(`/insurance/${policy.id}?status=updated`);
}

export async function deleteInsuranceAction(policyId: string): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/insurance/${policyId}?status=mock-deleted`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteRiderInsurance(policyId);
  } catch {
    redirect(`/insurance/${policyId}?status=delete-error`);
  }

  revalidatePath("/insurance");
  redirect("/insurance?status=deleted");
}
