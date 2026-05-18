"use server";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createServiceOpsApiClient, serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { logoutServiceOpsSession, setServiceOpsSession } from "@/lib/services/service-ops-session";

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
    redirect("/overview?auth=service-ops");
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

  redirect("/dashboard?auth=supabase");
}


export async function signOutAdmin() {
  await logoutServiceOpsSession();
  redirect("/login?status=signed-out");
}
