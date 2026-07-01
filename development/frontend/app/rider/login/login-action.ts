"use server";

import { riderApiConfigured, riderLogin } from "@/lib/services/rider-api";
import { setRiderSession } from "@/lib/services/rider-session";

export async function loginRiderAction(formData: FormData): Promise<{ error: string } | void> {
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!phoneNumber || !password) {
    return { error: "전화번호와 비밀번호를 입력하세요." };
  }
  if (!riderApiConfigured()) {
    return { error: "서버가 구성되지 않았습니다. 관리자에게 문의하세요." };
  }

  try {
    const auth = await riderLogin(phoneNumber, password);
    await setRiderSession(auth);
  } catch {
    return { error: "전화번호 또는 비밀번호가 올바르지 않습니다." };
  }

  // 성공 — 여기서 redirect() 하면 클라이언트 라우터가 stale RSC(관리자 로그인 UI)를
  // 그리는 문제가 있어, 호출한 클라이언트가 window.location 으로 풀 로드하도록 void 반환한다.
}
