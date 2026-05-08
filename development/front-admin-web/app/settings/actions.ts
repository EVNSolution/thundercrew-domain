"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { setMockNcpMapEnabled } from "@/lib/services/admin-preferences-mock-store";
import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

/**
 * Toggles the per-admin NCP map preference. Reads the desired state from the
 * form's hidden `nextValue` field so the calling form can be a single button
 * (operator does not have to confirm in a separate textbox).
 */
export async function updateAdminNcpMapPreferenceAction(formData: FormData): Promise<void> {
  const nextValueRaw = String(formData.get("nextValue") ?? "").toLowerCase().trim();
  const nextValue = nextValueRaw === "true";

  if (!serviceOpsApiConfigured()) {
    // Dev-only path: persist the new value in the in-memory mock store so
    // the toggle visibly flips during local frontend dev. The settings
    // page already renders a notice explaining the value is per-process.
    setMockNcpMapEnabled(nextValue);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    redirect(nextValue ? "/settings?status=enabled" : "/settings?status=disabled");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.updateAdminPreferences({ ncpMapEnabled: nextValue });
  } catch {
    redirect("/settings?status=save-error");
  }

  // Both /settings (toggle widget) and /dashboard (MapShell) read the
  // preference, so revalidate both paths.
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect(nextValue ? "/settings?status=enabled" : "/settings?status=disabled");
}
