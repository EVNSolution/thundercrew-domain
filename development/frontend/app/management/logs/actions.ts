"use server";

import { redirect } from "next/navigation";

import {
  serviceOpsApiConfigured,
  type ServiceOpsAuditLog
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export async function listAuditLogsAction(entityType?: string): Promise<ServiceOpsAuditLog[]> {
  if (!serviceOpsApiConfigured()) {
    return [];
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  return client.listAuditLogs({ entityType, limit: 200 });
}
