"use server";

import { redirect } from "next/navigation";

import {
  serviceOpsApiConfigured,
  createServiceOpsApiClient,
  type BulkPreviewResponse,
  type BulkApplyResponse
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export async function bulkPreviewRidersAction(formData: FormData): Promise<BulkPreviewResponse> {
  if (!serviceOpsApiConfigured()) {
    throw new Error("Service OPS API is not configured");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const file = formData.get("file") as File;
  return client.bulkPreviewRiders(file);
}

export async function bulkApplyRidersAction(formData: FormData): Promise<BulkApplyResponse> {
  if (!serviceOpsApiConfigured()) {
    throw new Error("Service OPS API is not configured");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const file = formData.get("file") as File;
  return client.bulkApplyRiders(file);
}

export function getRidersExportUrl(): string {
  return createServiceOpsApiClient().getRidersExportUrl();
}
