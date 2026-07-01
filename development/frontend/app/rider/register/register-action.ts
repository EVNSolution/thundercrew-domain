"use server";

import { RiderApiError, riderApiConfigured, riderRegister } from "@/lib/services/rider-api";
import { setRiderSession } from "@/lib/services/rider-session";

export async function registerRiderAction(formData: FormData): Promise<{ error: string } | void> {
  const name = String(formData.get("name") ?? "").trim();
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name || !phoneNumber || !password) return { error: "이름·전화번호·비밀번호를 모두 입력하세요." };
  if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };
  if (!riderApiConfigured()) return { error: "서버가 구성되지 않았습니다." };
  try {
    const auth = await riderRegister(name, phoneNumber, password);
    await setRiderSession(auth);
  } catch (e) {
    if (e instanceof RiderApiError) {
      if (e.status === 409) return { error: "이미 가입된 계정입니다. 로그인하세요." };
      if (e.status === 401 || e.status === 404) return { error: "이름·전화번호가 일치하는 라이더가 없습니다. 관리자에게 문의하세요." };
      if (e.status === 400) return { error: "비밀번호는 8자 이상이어야 합니다." };
    }
    return { error: "가입에 실패했습니다. 잠시 후 다시 시도하세요." };
  }
  // 성공 — 클라이언트가 window.location 으로 풀 로드(아래 페이지). redirect() 시 stale RSC 문제.
}
