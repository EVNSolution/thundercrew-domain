"use server";

import { redirect } from "next/navigation";

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

  // 쿼리로 클라이언트 라우터 캐시를 버스팅 — 없으면 로그인 전 프리페치된 stale RSC가
  // 잠깐 보였다가 새로고침해야 정상화되는 문제가 있다(관리자 로그인의 ?auth=... 와 동일 원리).
  redirect("/rider?from=login");
}
