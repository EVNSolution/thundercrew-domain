"use server";

import { redirect } from "next/navigation";

import {
  serviceOpsApiConfigured,
  type BulkPreviewResponse,
  type BulkApplyResponse,
  type FrontendRider
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export async function resetRiderCredentialAction(
  riderId: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!riderId) return { ok: false, error: "라이더 ID가 없습니다." };
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "새 비밀번호는 8자 이상이어야 합니다." };
  }
  if (!serviceOpsApiConfigured()) {
    return { ok: false, error: "서버가 구성되지 않았습니다." };
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.setRiderCredential(riderId, newPassword);
    return { ok: true };
  } catch {
    return { ok: false, error: "비밀번호 재설정에 실패했습니다. 잠시 후 다시 시도하세요." };
  }
}

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


export async function listRidersAction(): Promise<FrontendRider[]> {
  if (!serviceOpsApiConfigured()) {
    return [];
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const page = await client.listRiders({ page: 0, size: 200 });
  return page.items;
}
