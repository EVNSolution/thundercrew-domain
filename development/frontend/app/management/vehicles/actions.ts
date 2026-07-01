"use server";

import { redirect } from "next/navigation";

import {
  serviceOpsApiConfigured,
  ServiceOpsApiError,
  type BulkPreviewResponse,
  type BulkApplyResponse,
  type FrontendVehicle
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


export async function listVehiclesAction(): Promise<FrontendVehicle[]> {
  if (!serviceOpsApiConfigured()) {
    return [];
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const page = await client.listVehicles({ page: 0, size: 200 });
  return page.items;
}

export async function deleteVehicleAction(vehicleId: string): Promise<{ ok: boolean; message?: string }> {
  if (!serviceOpsApiConfigured()) {
    return { ok: false, message: "서버가 구성되지 않았습니다." };
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    // IMEI 단말기가 부착되어 있으면 백엔드가 차량 삭제를 거부한다 (FK constraint).
    // 먼저 활성 bike_device_installation 을 모두 해제한 뒤 차량을 삭제한다.
    const installations = await client.listBikeDeviceInstallations({ bikeId: vehicleId, size: 200 });
    const activeInstallations = installations.items.filter(
      (inst) => inst.bikeId === vehicleId && inst.removedAt === null
    );
    for (const inst of activeInstallations) {
      await client.removeBikeDeviceInstallation(inst.id, {
        removedAt: new Date().toISOString(),
        memo: "차량 삭제 전 자동 해제"
      });
    }
    await client.deleteVehicle(vehicleId);
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceOpsApiError) {
      if (e.status === 409 || e.status === 400) {
        return { ok: false, message: "활성 매칭/참조가 있어 삭제할 수 없습니다. 먼저 매칭을 종료하세요." };
      }
      return { ok: false, message: e.message || "삭제 처리 중 오류가 발생했습니다." };
    }
    return { ok: false, message: "삭제 처리 중 오류가 발생했습니다." };
  }
}
