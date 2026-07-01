"use server";

import { RiderApiError, riderApiConfigured, riderChangePassword } from "@/lib/services/rider-api";
import { getRiderAccessToken } from "@/lib/services/rider-session";

export async function changeRiderPasswordAction(
  formData: FormData
): Promise<{ error: string } | void> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "모든 항목을 입력하세요." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "새 비밀번호가 일치하지 않습니다." };
  }
  if (newPassword.length < 8) {
    return { error: "새 비밀번호는 8자 이상이어야 합니다." };
  }
  if (!riderApiConfigured()) {
    return { error: "서버가 구성되지 않았습니다. 관리자에게 문의하세요." };
  }

  const accessToken = await getRiderAccessToken();
  if (!accessToken) {
    return { error: "로그인이 필요합니다." };
  }

  try {
    await riderChangePassword(accessToken, currentPassword, newPassword);
  } catch (e) {
    if (e instanceof RiderApiError) {
      if (e.status === 401) return { error: "현재 비밀번호가 올바르지 않습니다." };
      if (e.status === 400) return { error: "새 비밀번호는 8자 이상이어야 합니다." };
    }
    return { error: "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도하세요." };
  }

  // 성공 — 클라이언트가 window.location 으로 풀 로드(아래 페이지). redirect() 시 stale RSC 문제.
}
