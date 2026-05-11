"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type ServiceOpsBikeOperationStatus,
  type ServiceOpsStationStatus,
  type ServiceOpsRiderEducationType,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

/**
 * /overview tab create actions. Each posts a single backend create call,
 * revalidates /overview, and redirects back to the originating tab so the
 * dialog unmounts and the table picks up the new row. Mock mode (no
 * service-ops backend) silent-redirects so the dialog UX stays preview-
 * able without a real connection.
 */

export async function createRiderFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=riders");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let riderId: string;
  try {
    const rider = await client.createRider({
      name: requiredText(formData.get("name")),
      phoneNumber: requiredText(formData.get("phoneNumber"))
    });
    riderId = rider.id ?? rider.slug;
  } catch {
    redirect("/overview?tab=riders&status=create-error");
  }

  // Optional 교육 여부 sidecar: when the operator picked ONLINE / OFFLINE
  // we stamp a fresh rider_education_record with completedAt = now so
  // the /overview riders tab's 교육 여부 column lights up immediately.
  const educationTypeRaw = String(formData.get("initialEducationType") ?? "").trim();
  if (educationTypeRaw === "ONLINE" || educationTypeRaw === "OFFLINE") {
    try {
      await client.createRiderEducationRecord({
        riderId,
        educationType: educationTypeRaw as ServiceOpsRiderEducationType,
        completedAt: new Date().toISOString(),
        courseName: null,
        expiresAt: null,
        certificateNo: null,
        issuingAuthority: null,
        evidenceUrl: null,
        memo: null
      });
    } catch {
      // Fail-soft - the rider exists; operator can register the education
      // record from the (future) detail flow later.
    }
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
      // Operator no longer enters VIN at register time; backend still
      // requires the field so we send an empty string and let the
      // operator fill it in via an update flow later.
      vin: "",
      modelName: optionalText(formData.get("modelName")),
      operationStatus: String(formData.get("operationStatus") ?? "READY") as ServiceOpsBikeOperationStatus
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

  // Dialog only collects the three fields the operator wants to fill on
  // register (address + 총·잔여 수량); the rest of BatteryStationCreate
  // Input is filled with sensible defaults that the operator can correct
  // later via the backend's update endpoint.
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
      availableBatteryCount
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
