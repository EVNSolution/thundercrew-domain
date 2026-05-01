"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import {
  toBikeEquipmentCreatePayload,
  toBikeEquipmentRemovePayload,
  toBikeEquipmentUpdatePayload,
  toEquipmentTypeCreatePayload,
  toEquipmentTypeUpdatePayload
} from "@/lib/services/equipment-command-payload";

export async function createEquipmentTypeAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/equipment?status=mock-saved");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let equipmentType;
  try {
    equipmentType = await client.createEquipmentType(toEquipmentTypeCreatePayload(formData));
  } catch {
    redirect("/equipment/types/new?status=save-error");
  }

  revalidatePath("/equipment");
  redirect(`/equipment/types/${equipmentType.id}?status=created`);
}

export async function updateEquipmentTypeAction(equipmentTypeId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/equipment/types/${equipmentTypeId}?status=mock-saved`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let equipmentType;
  try {
    equipmentType = await client.updateEquipmentType(equipmentTypeId, toEquipmentTypeUpdatePayload(formData));
  } catch {
    redirect(`/equipment/types/${equipmentTypeId}?status=save-error`);
  }

  revalidatePath("/equipment");
  revalidatePath(`/equipment/types/${equipmentType.id}`);
  redirect(`/equipment/types/${equipmentType.id}?status=updated`);
}

export async function createBikeEquipmentAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/equipment?status=mock-saved");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let equipment;
  try {
    equipment = await client.createBikeEquipment(toBikeEquipmentCreatePayload(formData));
  } catch {
    redirect("/equipment/new?status=save-error");
  }

  revalidatePath("/equipment");
  redirect(`/equipment/${equipment.id}?status=created`);
}

export async function updateBikeEquipmentAction(equipmentId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/equipment/${equipmentId}?status=mock-saved`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let equipment;
  try {
    equipment = await client.updateBikeEquipment(equipmentId, toBikeEquipmentUpdatePayload(formData));
  } catch {
    redirect(`/equipment/${equipmentId}/edit?status=save-error`);
  }

  revalidatePath("/equipment");
  revalidatePath(`/equipment/${equipment.id}`);
  redirect(`/equipment/${equipment.id}?status=updated`);
}

export async function removeBikeEquipmentAction(equipmentId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/equipment/${equipmentId}?status=mock-removed`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let equipment;
  try {
    equipment = await client.removeBikeEquipment(equipmentId, toBikeEquipmentRemovePayload(formData));
  } catch {
    redirect(`/equipment/${equipmentId}?status=remove-error`);
  }

  revalidatePath("/equipment");
  revalidatePath(`/equipment/${equipment.id}`);
  redirect(`/equipment/${equipment.id}?status=removed`);
}
