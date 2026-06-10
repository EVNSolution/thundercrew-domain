"use server";

import { redirect } from "next/navigation";

import {
  serviceOpsApiConfigured,
  createServiceOpsApiClient,
  type BulkPreviewResponse,
  type BulkApplyResponse
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export async function bulkPreviewMatchingAction(formData: FormData): Promise<BulkPreviewResponse> {
  if (!serviceOpsApiConfigured()) {
    throw new Error("Service OPS API is not configured");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const file = formData.get("file") as File;
  return client.bulkPreviewMatching(file);
}

export async function bulkApplyMatchingAction(formData: FormData): Promise<BulkApplyResponse> {
  if (!serviceOpsApiConfigured()) {
    throw new Error("Service OPS API is not configured");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const file = formData.get("file") as File;
  return client.bulkApplyMatching(file);
}

export function getMatchingExportUrl(): string {
  return createServiceOpsApiClient().getMatchingExportUrl();
}
