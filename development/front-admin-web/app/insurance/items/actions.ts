"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  toInsuranceItemCreatePayload,
  toInsuranceItemUpdatePayload
} from "@/lib/services/insurance-item-command-payload";
import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export async function createInsuranceItemAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/insurance/items?status=mock-saved");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let item;
  try {
    item = await client.createInsuranceItem(toInsuranceItemCreatePayload(formData));
  } catch {
    redirect("/insurance/items/new?status=save-error");
  }

  revalidatePath("/insurance/items");
  revalidatePath("/insurance/new");
  redirect(`/insurance/items/${item.id}?status=created`);
}

export async function updateInsuranceItemAction(itemId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/insurance/items/${itemId}?status=mock-saved`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let item;
  try {
    item = await client.updateInsuranceItem(itemId, toInsuranceItemUpdatePayload(formData));
  } catch {
    redirect(`/insurance/items/${itemId}/edit?status=save-error`);
  }

  revalidatePath("/insurance/items");
  revalidatePath("/insurance/new");
  revalidatePath(`/insurance/items/${item.id}`);
  redirect(`/insurance/items/${item.id}?status=updated`);
}

export async function deleteInsuranceItemAction(itemId: string, _formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/insurance/items/${itemId}?status=mock-deleted`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteInsuranceItem(itemId);
  } catch {
    redirect(`/insurance/items/${itemId}?status=delete-error`);
  }

  revalidatePath("/insurance/items");
  revalidatePath("/insurance/new");
  redirect("/insurance/items?status=deleted");
}
