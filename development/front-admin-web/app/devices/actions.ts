"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import {
  toBikeDeviceInstallationCreatePayload,
  toBikeDeviceInstallationRemovePayload,
  toDeviceCreatePayload,
  toDeviceUpdatePayload
} from "@/lib/services/device-command-payload";

export async function createDeviceAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/devices?status=mock-saved");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let device;
  try {
    device = await client.createDevice(toDeviceCreatePayload(formData));
  } catch {
    redirect("/devices/new?status=save-error");
  }

  revalidatePath("/devices");
  redirect(`/devices/${device.id}?status=created`);
}

export async function updateDeviceAction(deviceId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/devices/${deviceId}?status=mock-saved`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let device;
  try {
    device = await client.updateDevice(deviceId, toDeviceUpdatePayload(formData));
  } catch {
    redirect(`/devices/${deviceId}/edit?status=save-error`);
  }

  revalidatePath("/devices");
  revalidatePath(`/devices/${device.id}`);
  redirect(`/devices/${device.id}?status=updated`);
}

export async function deleteDeviceAction(deviceId: string): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/devices/${deviceId}?status=mock-deleted`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteDevice(deviceId);
  } catch {
    redirect(`/devices/${deviceId}?status=delete-error`);
  }

  revalidatePath("/devices");
  redirect("/devices?status=deleted");
}

export async function createBikeDeviceInstallationAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/devices?status=mock-saved");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let installation;
  try {
    installation = await client.createBikeDeviceInstallation(toBikeDeviceInstallationCreatePayload(formData));
  } catch {
    redirect("/devices/installations/new?status=save-error");
  }

  revalidatePath("/devices");
  redirect(`/devices/installations/${installation.id}?status=created`);
}

export async function removeBikeDeviceInstallationAction(installationId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/devices/installations/${installationId}?status=mock-removed`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let installation;
  try {
    installation = await client.removeBikeDeviceInstallation(installationId, toBikeDeviceInstallationRemovePayload(formData));
  } catch {
    redirect(`/devices/installations/${installationId}?status=remove-error`);
  }

  revalidatePath("/devices");
  revalidatePath(`/devices/installations/${installation.id}`);
  redirect(`/devices/installations/${installation.id}?status=removed`);
}
