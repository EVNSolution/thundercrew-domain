"use server";

import { redirect } from "next/navigation";

import {
  serviceOpsApiConfigured,
  createServiceOpsApiClient,
  type BulkPreviewResponse,
  type BulkApplyResponse
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export async function bulkPreviewVehiclesAction(formData: FormData): Promise<BulkPreviewResponse> {
  if (!serviceOpsApiConfigured()) {
    throw new Error("Service OPS API is not configured");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const file = formData.get("file") as File;
  return client.bulkPreviewVehicles(file);
}

export async function bulkApplyVehiclesAction(formData: FormData): Promise<BulkApplyResponse> {
  if (!serviceOpsApiConfigured()) {
    throw new Error("Service OPS API is not configured");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const file = formData.get("file") as File;
  return client.bulkApplyVehicles(file);
}

export function getVehiclesExportUrl(): string {
  return createServiceOpsApiClient().getVehiclesExportUrl();
}
