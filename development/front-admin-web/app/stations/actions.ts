"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import {
  toBatteryStationCountPayload,
  toBatteryStationCreatePayload,
  toBatteryStationUpdatePayload
} from "@/lib/services/station-command-payload";

export async function createStationAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/stations?status=mock-saved");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let station;
  try {
    const payload = toBatteryStationCreatePayload(formData);
    station = await client.createBatteryStation(payload);
  } catch {
    redirect("/stations/new?status=save-error");
  }

  revalidatePath("/stations");
  redirect(`/stations/${station.slug}?status=created`);
}

export async function updateStationAction(stationId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/stations/${stationId}?status=mock-saved`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let station;
  try {
    const payload = toBatteryStationUpdatePayload(formData);
    station = await client.updateBatteryStation(stationId, payload);
  } catch {
    redirect(`/stations/${stationId}/edit?status=save-error`);
  }

  revalidatePath("/stations");
  revalidatePath(`/stations/${station.slug}`);
  redirect(`/stations/${station.slug}?status=updated`);
}

export async function updateStationBatteryCountsAction(stationId: string, formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(`/stations/${stationId}?status=mock-count-updated`);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let station;
  try {
    const payload = toBatteryStationCountPayload(formData);
    station = await client.updateBatteryStationCounts(stationId, payload);
  } catch {
    redirect(`/stations/${stationId}?status=count-error`);
  }

  revalidatePath("/stations");
  revalidatePath(`/stations/${station.slug}`);
  redirect(`/stations/${station.slug}?status=count-updated`);
}
