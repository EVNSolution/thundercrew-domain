"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type ServiceOpsBikeOperationStatus,
  type ServiceOpsStationStatus,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

/**
 * /overview tab create actions. Each posts a single backend create call,
 * revalidates /overview, and redirects back to the originating tab so the
 * dialog unmounts and the table picks up the new row. All three actions
 * silently no-op (just redirect) when the backend is not configured so
 * the operator can preview the dialog UX in dev / mock mode.
 */

export async function createRiderFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=riders");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.createRider({
      name: requiredText(formData.get("name")),
      phoneNumber: requiredText(formData.get("phoneNumber")),
      teamName: optionalText(formData.get("teamName")),
      areaName: optionalText(formData.get("areaName")),
      memo: optionalText(formData.get("memo"))
    });
  } catch {
    redirect("/overview?tab=riders&status=create-error");
  }

  revalidatePath("/overview");
  redirect("/overview?tab=riders");
}

export async function createVehicleFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=vehicles");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.createVehicle({
      plateNumber: requiredText(formData.get("plateNumber")),
      vin: requiredText(formData.get("vin")),
      modelName: optionalText(formData.get("modelName")),
      operationStatus: String(formData.get("operationStatus") ?? "READY") as ServiceOpsBikeOperationStatus,
      memo: optionalText(formData.get("memo"))
    });
  } catch {
    redirect("/overview?tab=vehicles&status=create-error");
  }

  revalidatePath("/overview");
  redirect("/overview?tab=vehicles");
}

export async function createStationFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=stations");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  // Dialog only collects the four fields the operator wants to fill on
  // register; the rest of BatteryStationCreateInput is filled with
  // sensible defaults that the operator can correct later via the
  // backend's update endpoint.
  const address = requiredText(formData.get("address"));
  const maxBatteryCapacity = parseNumber(formData.get("maxBatteryCapacity"), 0);
  const availableBatteryCount = parseNumber(formData.get("availableBatteryCount"), 0);

  try {
    await client.createBatteryStation({
      name: address, // operator identifies station by address; can be edited later.
      address,
      latitude: 0, // placeholder — operator updates after geocoding.
      longitude: 0,
      status: "ACTIVE" as ServiceOpsStationStatus,
      maxBatteryCapacity,
      currentBatteryCount: availableBatteryCount,
      availableBatteryCount,
      memo: optionalText(formData.get("memo"))
    });
  } catch {
    redirect("/overview?tab=stations&status=create-error");
  }

  revalidatePath("/overview");
  redirect("/overview?tab=stations");
}

function requiredText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = requiredText(value);
  return text ? text : null;
}

function parseNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}
