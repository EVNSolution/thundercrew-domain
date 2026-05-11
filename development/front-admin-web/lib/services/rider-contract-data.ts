import {
  type ServiceOpsApiError,
  type ServiceOpsContractTemplate,
  type ServiceOpsRiderBikeContract,
  type FrontendVehicle,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type RiderContractRow = ServiceOpsRiderBikeContract & {
  bikeLabel: string | null;
  templateName: string | null;
  status: "활성" | "종료";
};

export type RiderContractsResult = {
  riderId: string;
  rows: RiderContractRow[];
  source: "service-ops" | "mock";
  notice?: string;
};

/**
 * Loader for the rider's bike contracts, used inline on
 * `/riders/[slug]`. Filters `/rider-bike-contracts` client-side and
 * enriches each row with the vehicle plate/model and the contract
 * template name so the section table can display human-readable
 * labels without the page component issuing a second fetch.
 */
export async function loadRiderContracts(riderId: string): Promise<RiderContractsResult> {
  if (!serviceOpsApiConfigured()) {
    return { riderId, rows: [], source: "mock" };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      riderId,
      rows: [],
      source: "mock",
      notice: "관리자 세션이 없어 계약 정보를 표시할 수 없습니다."
    };
  }

  try {
    const [contractPage, vehiclePage, templatePage] = await Promise.all([
      client.listRiderBikeContracts({ page: 0, size: 200 }),
      client.listVehicles({ page: 0, size: 200 }),
      client.listContractTemplates({ page: 0, size: 200 })
    ]);
    const bikes = new Map<string, FrontendVehicle>(
      vehiclePage.items.map((vehicle) => [vehicle.id ?? vehicle.slug, vehicle])
    );
    const templates = new Map<string, ServiceOpsContractTemplate>(
      templatePage.items.map((template) => [template.id, template])
    );
    const rows: RiderContractRow[] = contractPage.items
      .filter((contract) => contract.riderId === riderId)
      .map((contract) => {
        const bike = bikes.get(contract.bikeId);
        const template = templates.get(contract.contractTemplateId);
        return {
          ...contract,
          bikeLabel: bike ? `${bike.plateNumber} · ${bike.model}` : null,
          templateName: template?.name ?? null,
          status: contract.terminatedAt ? "종료" : "활성"
        };
      });
    return { riderId, rows, source: "service-ops" };
  } catch (error) {
    return {
      riderId,
      rows: [],
      source: "mock",
      notice: `계약 조회 실패.${formatServiceOpsError(error)}`
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
