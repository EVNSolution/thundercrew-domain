"use server";

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
  // redirect() 하지 않는다 — 클라이언트(RiderLogoutButton)가 window.location 으로 풀 로드해
  // 미들웨어가 비워진 세션과 함께 평가하도록. redirect() 시 stale RSC(관리자 로그인 UI) 문제.
}
