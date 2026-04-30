"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import {
  toRiderBikeContractCreatePayload,
  toRiderBikeContractMemoPayload,
  toRiderBikeContractTerminatePayload
} from "@/lib/services/contract-command-payload";

export async function createContractAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/contracts?status=mock-saved");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let contract;
  try {
    contract = await client.createRiderBikeContract(toRiderBikeContractCreatePayload(formData));
  } catch {
    redirect("/contracts/new?status=save-error");
  }

  revalidatePath("/contracts");
  redirect(`/contracts/${contract.id}?status=created`);
}

export async function updateContractMemoAction(contractId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/contracts/${contractId}?status=mock-updated`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let contract;
  try {
    contract = await client.updateRiderBikeContract(contractId, toRiderBikeContractMemoPayload(formData));
  } catch {
    redirect(`/contracts/${contractId}?status=save-error`);
  }

  revalidatePath("/contracts");
  revalidatePath(`/contracts/${contract.id}`);
  redirect(`/contracts/${contract.id}?status=updated`);
}

export async function terminateContractAction(contractId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/contracts/${contractId}?status=mock-terminated`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let contract;
  try {
    contract = await client.terminateRiderBikeContract(contractId, toRiderBikeContractTerminatePayload(formData));
  } catch {
    redirect(`/contracts/${contractId}?status=terminate-error`);
  }

  revalidatePath("/contracts");
  revalidatePath(`/contracts/${contract.id}`);
  redirect(`/contracts/${contract.id}?status=terminated`);
}
