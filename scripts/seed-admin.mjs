import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const text = readFileSync(".env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    process.env[key] = rest.join("=");
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

if (!url || !serviceRoleKey || !email || !password) {
  throw new Error("Missing Supabase admin seed environment values.");
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: "Thundercrew Test Admin" }
});

if (error && !error.message.toLowerCase().includes("already")) {
  throw error;
}

const userId = data.user?.id;
if (userId) {
  const { error: profileError } = await supabase.from("admin_users").upsert({
    id: userId,
    display_name: "Thundercrew Test Admin",
    role: "operator"
  });
  if (profileError) throw profileError;
}

console.log(JSON.stringify({ ok: true, email, user_created_or_exists: true, profile_upserted: Boolean(userId) }));
