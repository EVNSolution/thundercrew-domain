import {
  type ServiceOpsContractCategory,
  type ServiceOpsContractDurationUnit,
  type ServiceOpsContractReturnType,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type RiderActiveContractSummary = {
  category: ServiceOpsContractCategory | null;
  returnType: ServiceOpsContractReturnType | null;
  durationLabel: string | null;
  includesInsurance: boolean | null;
};

export type RiderMatchingSnapshot = {
  /** Total active rider-bike contracts (= matched pairs). */
  activeContractCount: number;
  /** rider ids with ≥1 active rider-bike contract. */
  matchedRiderIds: Set<string>;
  /** rider ids with ≥1 active rider-insurance row. */
  insuredRiderIds: Set<string>;
  /** rider ids with ≥1 rider-education-record row. */
  educatedRiderIds: Set<string>;
  /**
   * Per-rider summary of the rider's primary active contract's template
   * (category / returnType / duration / includesInsurance). When a
   * rider has multiple active contracts we keep the most recent one,
   * which is the natural "current arrangement" for table display.
   */
  riderActiveContractById: Map<string, RiderActiveContractSummary>;
  /** Map<bikeId, riderId> for active contracts - lets VehiclesPanel
   *  look up the rider currently driving a vehicle. */
  bikeActiveRiderById: Map<string, string>;
};

/**
 * Aggregate /overview needs to render the KPI tile + the three tab
 * panels' badge / template-summary columns in a single render. Pages
 * 200 rows from each list endpoint and buckets by id here.
 */
export async function loadRiderMatchingSnapshot(): Promise<RiderMatchingSnapshot> {
  const empty: RiderMatchingSnapshot = {
    activeContractCount: 0,
    matchedRiderIds: new Set(),
    insuredRiderIds: new Set(),
    educatedRiderIds: new Set(),
    riderActiveContractById: new Map(),
    bikeActiveRiderById: new Map()
  };

  if (!serviceOpsApiConfigured()) return empty;
  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) return empty;

  try {
    const [contractPage, insurancePage, educationPage, templatePage] = await Promise.all([
      client.listRiderBikeContracts({ page: 0, size: 200 }),
      client.listRiderInsurances({ page: 0, size: 200 }),
      client.listRiderEducationRecords({ page: 0, size: 200 }),
      client.listContractTemplates({ page: 0, size: 200 })
    ]);

    const templates = new Map<string, RiderActiveContractSummary>();
    for (const template of templatePage.items) {
      templates.set(template.id, {
        category: template.category ?? null,
        returnType: template.returnType ?? null,
        durationLabel: formatDurationLabel(
          template.unlimited,
          template.durationUnit ?? null,
          template.durationValue ?? null
        ),
        includesInsurance: template.includesInsurance ?? null
      });
    }

    const matchedRiderIds = new Set<string>();
    const bikeActiveRiderById = new Map<string, string>();
    const riderActiveContractById = new Map<string, RiderActiveContractSummary>();
    let activeContractCount = 0;
    // Sort by createdAt desc so the per-rider map ends up with the most
    // recent active contract when a rider has more than one in flight.
    const sortedActive = contractPage.items
      .filter((contract) => contract.terminatedAt === null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const contract of sortedActive) {
      activeContractCount += 1;
      matchedRiderIds.add(contract.riderId);
      bikeActiveRiderById.set(contract.bikeId, contract.riderId);
      if (!riderActiveContractById.has(contract.riderId)) {
        const tpl = templates.get(contract.contractTemplateId);
        riderActiveContractById.set(
          contract.riderId,
          tpl ?? {
            category: null,
            returnType: null,
            durationLabel: null,
            includesInsurance: null
          }
        );
      }
    }

    const insuredRiderIds = new Set<string>();
    for (const policy of insurancePage.items) {
      if (policy.enabled) insuredRiderIds.add(policy.riderId);
    }

    const educatedRiderIds = new Set<string>();
    for (const record of educationPage.items) {
      educatedRiderIds.add(record.riderId);
    }

    return {
      activeContractCount,
      matchedRiderIds,
      insuredRiderIds,
      educatedRiderIds,
      riderActiveContractById,
      bikeActiveRiderById
    };
  } catch {
    return empty;
  }
}

function formatDurationLabel(
  unlimited: boolean | undefined,
  unit: ServiceOpsContractDurationUnit | null | undefined,
  value: number | null | undefined
): string | null {
  if (unlimited) return "무제한";
  if (!unit || value === null || value === undefined) return null;
  const suffix: Record<ServiceOpsContractDurationUnit, string> = {
    DAY: "일",
    WEEK: "주",
    MONTH: "개월",
    QUARTER: "분기",
    HALF_YEAR: "반기",
    YEAR: "년"
  };
  return `${value}${suffix[unit] ?? ""}`;
}
