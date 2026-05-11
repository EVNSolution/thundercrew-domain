import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type RiderMatchingSnapshot = {
  /** Total number of active rider-bike contracts (= matched pairs). */
  activeContractCount: number;
  /** rider ids that have at least one active rider-bike contract. */
  matchedRiderIds: Set<string>;
  /** rider ids that have at least one active rider-insurance row. */
  insuredRiderIds: Set<string>;
};

/**
 * Aggregate /overview needs to render both the "매칭" KPI tile and the
 * 계약/보험 columns on the riders tab in a single render. Backend has no
 * rider-keyed aggregate endpoint yet, so we page the two list endpoints
 * once (size 200) and bucket by riderId here. Replaces the earlier
 * `loadActiveRiderBikeContractsCount` loader which only returned a
 * scalar count.
 *
 * Returns empty snapshot on every fallback path (no env, no session, API
 * error) so the page can render KPI 0 and "없음" badges cleanly.
 */
export async function loadRiderMatchingSnapshot(): Promise<RiderMatchingSnapshot> {
  const empty: RiderMatchingSnapshot = {
    activeContractCount: 0,
    matchedRiderIds: new Set(),
    insuredRiderIds: new Set()
  };

  if (!serviceOpsApiConfigured()) return empty;
  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) return empty;

  try {
    const [contractPage, insurancePage] = await Promise.all([
      client.listRiderBikeContracts({ page: 0, size: 200 }),
      client.listRiderInsurances({ page: 0, size: 200 })
    ]);
    const matchedRiderIds = new Set<string>();
    let activeContractCount = 0;
    for (const contract of contractPage.items) {
      if (contract.terminatedAt === null) {
        activeContractCount += 1;
        matchedRiderIds.add(contract.riderId);
      }
    }
    const insuredRiderIds = new Set<string>();
    for (const policy of insurancePage.items) {
      if (policy.enabled) {
        insuredRiderIds.add(policy.riderId);
      }
    }
    return { activeContractCount, matchedRiderIds, insuredRiderIds };
  } catch {
    return empty;
  }
}
