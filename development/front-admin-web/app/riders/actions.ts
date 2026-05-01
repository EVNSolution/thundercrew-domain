"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type RiderCreateInput, serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
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

  revalidatePath("/riders");
  redirect(`/riders/${rider.slug}?status=created`);
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
