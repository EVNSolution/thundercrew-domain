"use server";

import { redirect } from "next/navigation";

import {
  serviceOpsApiConfigured,
  ServiceOpsApiError
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

/**
 * OTOPLUG NT observer (단말 데이터 수신) 제어 server actions.
 *
 * register/ignore 는 백엔드가 driving · drivingDetail observer 를 등록/해제해
 * 단말 텔레메트리 유입을 켜고 끈다. 자원관리 페이지의
 * `TelemetryReceiveControl` 이 이 액션들을 호출한다.
 */

export async function getTelemetryReceiveStatusAction(): Promise<{ active: boolean } | null> {
  if (!serviceOpsApiConfigured()) {
    return null;
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    const status = await client.getOtoplugObserverStatus();
    return { active: status.active };
  } catch {
    return null;
  }
}

export async function startTelemetryReceiveAction(): Promise<{ ok: boolean; message?: string }> {
  if (!serviceOpsApiConfigured()) {
    return { ok: false, message: "서버가 구성되지 않았습니다." };
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.registerOtoplugObservers();
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceOpsApiError) {
      return { ok: false, message: e.message || "수신 시작 실패 — OTOPLUG 설정을 확인하세요." };
    }
    return { ok: false, message: "수신 시작 실패 — OTOPLUG 설정을 확인하세요." };
  }
}

export async function stopTelemetryReceiveAction(): Promise<{ ok: boolean; message?: string }> {
  if (!serviceOpsApiConfigured()) {
    return { ok: false, message: "서버가 구성되지 않았습니다." };
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.ignoreOtoplugObservers();
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceOpsApiError) {
      return { ok: false, message: e.message ?? "수신 중지 실패." };
    }
    return { ok: false, message: "수신 중지 실패." };
  }
}
