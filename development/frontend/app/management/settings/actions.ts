"use server";

import { redirect } from "next/navigation";

import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

/**
 * 운영 설정 (4단계 §6) 서버 액션. 값은 백엔드 app_settings 오버레이 — 완료
 * 자동 추정·시간 배차의 기준값을 재배포 없이 현장 보정한다. 테마/액센트는
 * 브라우저 로컬(localStorage)이라 여기 없다.
 */

export type OperationalSettings = Record<string, number>;

export async function getSettingsAction(): Promise<OperationalSettings | null> {
  if (!serviceOpsApiConfigured()) return null;
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }
  try {
    return await client.getSettings();
  } catch {
    return null;
  }
}

export async function updateSettingsAction(
  values: OperationalSettings
): Promise<{ ok: boolean; message?: string; values?: OperationalSettings }> {
  if (!serviceOpsApiConfigured()) return { ok: false, message: "서버가 구성되지 않았습니다." };
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, message: "세션이 만료됐습니다." };
  try {
    const next = await client.updateSettings(values);
    return { ok: true, values: next };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "저장 실패" };
  }
}
