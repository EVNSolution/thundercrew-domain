"use server";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createServiceOpsApiClient, serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import {
  createAuthenticatedServiceOpsApiClient,
  logoutServiceOpsSession,
  setServiceOpsSession
} from "@/lib/services/service-ops-session";

export async function signInAdmin(formData: FormData) {
  const loginId = String(formData.get("loginId") ?? formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (serviceOpsApiConfigured()) {
    if (!loginId || !password) {
      redirect("/login?status=missing-credentials");
    }

    let auth;
    try {
      auth = await createServiceOpsApiClient().login({ loginId, password });
    } catch {
      redirect("/login?status=service-ops-auth-error");
    }

    await setServiceOpsSession(auth);
    redirect("/?auth=service-ops");
  }

  const email = loginId;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("<project-ref>")) {
    redirect("/login?status=missing-env");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?status=auth-error");
  }

  redirect("/?auth=supabase");
}


export async function signOutAdmin() {
  await logoutServiceOpsSession();
  redirect("/login?status=signed-out");
}

/**
 * 로그인된 admin 본인 비밀번호 변경. 우상단 floating bar 의 "비밀번호 변경"
 * 다이얼로그 form 이 호출. 현재 비밀번호 미일치 / 새 비밀번호 길이 미달 시
 * status 파라미터로 안내 메시지를 띄운다.
 *
 * 성공 시엔 `/?status=password-changed` 로 redirect — 운영자에게 변경 결과를
 * 보여주고 세션은 그대로 유지 (강제 로그아웃 없음).
 */
export async function changeAdminPassword(formData: FormData) {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) {
    redirect("/?status=password-missing");
  }
  if (newPassword.length < 8) {
    redirect("/?status=password-too-short");
  }
  if (newPassword !== confirmPassword) {
    redirect("/?status=password-mismatch");
  }
  if (!serviceOpsApiConfigured()) {
    redirect("/?status=password-changed");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.changeAdminPassword({ currentPassword, newPassword });
  } catch {
    // 401 / 기타 — 현재 비밀번호 미일치가 가장 빈번한 케이스.
    redirect("/?status=password-current-mismatch");
  }

  redirect("/?status=password-changed");
}
