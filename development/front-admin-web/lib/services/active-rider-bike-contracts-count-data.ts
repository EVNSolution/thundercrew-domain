import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

/**
 * Minimal aggregate used by `/overview` to render the "매칭 차량 / 매칭
 * 인원" KPI tile - counts active rider-bike contracts (those with
 * `terminatedAt === null`). Returns 0 on every fallback path so the KPI
 * stays renderable in env-less / no-session / API-error scenarios.
 *
 * Lives in its own module so the legacy `/contracts` hub loader can be
 * deleted without /overview keeping a stale dependency.
 */
export async function loadActiveRiderBikeContractsCount(): Promise<number> {
  if (!serviceOpsApiConfigured()) return 0;
  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) return 0;
  try {
    const page = await client.listRiderBikeContracts({ page: 0, size: 200 });
    return page.items.filter((contract) => contract.terminatedAt === null).length;
  } catch {
    return 0;
  }
}
