"use server";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export async function signInAdmin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
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
