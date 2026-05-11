import {
  type ServiceOpsApiError,
  type ServiceOpsInsuranceItem,
  type ServiceOpsRiderInsurance,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type RiderInsuranceRow = ServiceOpsRiderInsurance & {
  insuranceItemName: string | null;
};

export type RiderInsurancesResult = {
  riderId: string;
  rows: RiderInsuranceRow[];
  source: "service-ops" | "mock";
  notice?: string;
};

/**
 * Loader for the rider's insurance policies, used inline on
 * `/riders/[slug]`. The backend does not expose a rider-scoped list
 * endpoint yet, so we page through `/rider-insurances` (size 200) and
 * filter client-side. Insurance item names are joined from the catalog
 * lookup so the table can render "보험 항목" without a second fetch in
 * the page component.
 */
export async function loadRiderInsurances(riderId: string): Promise<RiderInsurancesResult> {
  if (!serviceOpsApiConfigured()) {
    return { riderId, rows: [], source: "mock" };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      riderId,
      rows: [],
      source: "mock",
      notice: "관리자 세션이 없어 보험 정보를 표시할 수 없습니다."
    };
  }

  try {
    const [policyPage, itemPage] = await Promise.all([
      client.listRiderInsurances({ page: 0, size: 200 }),
      client.listInsuranceItems({ page: 0, size: 200 })
    ]);
    const items = new Map<string, ServiceOpsInsuranceItem>(
      itemPage.items.map((item) => [item.id, item])
    );
    const rows: RiderInsuranceRow[] = policyPage.items
      .filter((policy) => policy.riderId === riderId)
      .map((policy) => ({
        ...policy,
        insuranceItemName: items.get(policy.insuranceItemId)?.name ?? null
      }));
    return { riderId, rows, source: "service-ops" };
  } catch (error) {
    return {
      riderId,
      rows: [],
      source: "mock",
      notice: `보험 조회 실패.${formatServiceOpsError(error)}`
    };
  }
}

function formatServiceOpsError(error: unknown): string {
  const apiError = error as Partial<ServiceOpsApiError> | undefined;
  if (apiError?.code) {
    return ` (${apiError.code})`;
  }
  if (error instanceof Error) {
    return ` (${error.message})`;
  }
  return "";
}
