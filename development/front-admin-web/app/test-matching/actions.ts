"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

const PAGE = "/test-matching";

function getClient() {
  if (!serviceOpsApiConfigured()) redirect(PAGE);
  return createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
}

// ── Vehicles ──

export async function createTestVehicleAction(formData: FormData): Promise<void> {
  const client = await getClient();
  if (!client) redirect(`/login?status=session-required`);

  const plateNumber = String(formData.get("plateNumber") ?? "").trim();
  const bikeType = String(formData.get("bikeType") ?? "") as "TWO_WHEEL" | "FOUR_WHEEL";
  const engineType = String(formData.get("engineType") ?? "") as "ELECTRIC" | "ICE";
  const imeiRaw = String(formData.get("imei") ?? "").trim();
  const imei = imeiRaw.length === 15 ? imeiRaw : null;

  try {
    await client.createTestVehicle({ plateNumber, bikeType, engineType, imei });
  } catch {
    redirect(`${PAGE}?error=vehicle-create`);
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}

export async function deleteTestVehicleAction(formData: FormData): Promise<void> {
  const client = await getClient();
  if (!client) redirect(`/login?status=session-required`);
  const id = String(formData.get("id") ?? "").trim();
  try {
    await client.deleteTestVehicle(id);
  } catch {
    redirect(`${PAGE}?error=vehicle-delete`);
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}

// ── Riders ──

export async function createTestRiderAction(formData: FormData): Promise<void> {
  const client = await getClient();
  if (!client) redirect(`/login?status=session-required`);

  const name = String(formData.get("name") ?? "").trim();
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
  const trainingStatus = String(formData.get("trainingStatus") ?? "") as
    "ONLINE" | "OFFLINE" | "INCOMPLETE";
  const teamNameRaw = String(formData.get("teamName") ?? "").trim();
  const teamName = teamNameRaw || null;

  try {
    await client.createTestRider({ name, phoneNumber, trainingStatus, teamName });
  } catch {
    redirect(`${PAGE}?error=rider-create`);
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}

export async function deleteTestRiderAction(formData: FormData): Promise<void> {
  const client = await getClient();
  if (!client) redirect(`/login?status=session-required`);
  const id = String(formData.get("id") ?? "").trim();
  try {
    await client.deleteTestRider(id);
  } catch {
    redirect(`${PAGE}?error=rider-delete`);
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}

// ── Matchings ──

export async function createTestMatchingAction(formData: FormData): Promise<void> {
  const client = await getClient();
  if (!client) redirect(`/login?status=session-required`);

  const testVehicleId = String(formData.get("testVehicleId") ?? "").trim();
  const serviceType = String(formData.get("serviceType") ?? "") as
    "CALL_DELIVERY" | "DESIGNATED_DELIVERY" | "COLLECTION_CARE" | "BATCH_COLLECTION";
  const testRiderId = String(formData.get("testRiderId") ?? "").trim();
  const contractType = String(formData.get("contractType") ?? "") as "SUBSCRIPTION" | "RENTAL";
  const handoverType = String(formData.get("handoverType") ?? "") as "TAKEOVER" | "RETURN";
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();

  try {
    await client.createTestMatching({
      testVehicleId, serviceType, testRiderId,
      contractType, handoverType, startDate, endDate,
    });
  } catch {
    redirect(`${PAGE}?error=matching-create`);
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}

export async function deleteTestMatchingAction(formData: FormData): Promise<void> {
  const client = await getClient();
  if (!client) redirect(`/login?status=session-required`);
  const id = String(formData.get("id") ?? "").trim();
  try {
    await client.deleteTestMatching(id);
  } catch {
    redirect(`${PAGE}?error=matching-delete`);
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}
