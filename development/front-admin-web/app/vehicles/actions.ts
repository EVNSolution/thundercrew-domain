"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import {
  toVehicleCreatePayload,
  toVehicleStatusPayload,
  toVehicleUpdatePayload
} from "@/lib/services/vehicle-command-payload";

export async function createVehicleAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/vehicles?status=mock-saved");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let vehicle;
  try {
    const payload = toVehicleCreatePayload(formData);
    vehicle = await client.createVehicle(payload);
  } catch {
    redirect("/vehicles/new?status=save-error");
  }

  revalidatePath("/vehicles");
  redirect(`/vehicles/${vehicle.slug}?status=created`);
}

export async function updateVehicleAction(vehicleId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/vehicles/${vehicleId}?status=mock-saved`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let vehicle;
  try {
    const payload = toVehicleUpdatePayload(formData);
    vehicle = await client.updateVehicle(vehicleId, payload);
  } catch {
    redirect(`/vehicles/${vehicleId}/edit?status=save-error`);
  }

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicle.slug}`);
  redirect(`/vehicles/${vehicle.slug}?status=updated`);
}

export async function changeVehicleOperationStatusAction(vehicleId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/vehicles/${vehicleId}?status=mock-status-updated`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let vehicle;
  try {
    const payload = toVehicleStatusPayload(formData);
    vehicle = await client.changeVehicleOperationStatus(vehicleId, payload);
  } catch {
    redirect(`/vehicles/${vehicleId}?status=status-error`);
  }

  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${vehicle.slug}`);
  redirect(`/vehicles/${vehicle.slug}?status=status-updated`);
}
