"use server";

import { redirect } from "next/navigation";

import { riderApiConfigured, riderLogout } from "@/lib/services/rider-api";
import { clearRiderSession, getRiderAccessToken } from "@/lib/services/rider-session";

export async function logoutRiderAction(): Promise<void> {
  const accessToken = await getRiderAccessToken();
  try {
    if (riderApiConfigured() && accessToken) {
      await riderLogout(accessToken);
    }
  } catch {
    // 무상태 — 서버 로그아웃 실패해도 쿠키 정리가 최종 기준.
  }
  await clearRiderSession();
  redirect("/rider/login");
}
