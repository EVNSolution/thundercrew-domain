"use server";

import { redirect } from "next/navigation";

import {
  serviceOpsApiConfigured,
  ServiceOpsApiError,
  type BulkPreviewResponse,
  type BulkApplyResponse,
  type ServiceOpsRiderBikeContract
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


export async function listMatchingAction(): Promise<ServiceOpsRiderBikeContract[]> {
  if (!serviceOpsApiConfigured()) {
    return [];
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const page = await client.listRiderBikeContracts({ page: 0, size: 200 });
  return page.items;
}

export async function terminateMatchingAction(contractId: string): Promise<{ ok: boolean; message?: string }> {
  if (!serviceOpsApiConfigured()) {
    return { ok: false, message: "서버가 구성되지 않았습니다." };
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.terminateRiderBikeContract(contractId, {
      terminatedAt: new Date().toISOString(),
      terminatedReason: "OPERATOR_TERMINATE"
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceOpsApiError) {
      if (e.status === 409 || e.status === 400) {
        return { ok: false, message: "이미 종료되었거나 종료할 수 없는 계약입니다." };
      }
      return { ok: false, message: e.message || "종료 처리 중 오류가 발생했습니다." };
    }
    return { ok: false, message: "종료 처리 중 오류가 발생했습니다." };
  }
}
