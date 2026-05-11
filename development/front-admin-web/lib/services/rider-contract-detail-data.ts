import {
  type ServiceOpsApiError,
  type ServiceOpsRiderBikeContract,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type RiderContractDetailResult = {
  contractId: string;
  data: ServiceOpsRiderBikeContract | null;
  source: "service-ops" | "mock";
  notice?: string;
};

/** Single-record loader for the rider contract edit page. */
export async function loadRiderContractDetail(
  contractId: string
): Promise<RiderContractDetailResult> {
  if (!serviceOpsApiConfigured()) {
    return { contractId, data: null, source: "mock" };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      contractId,
      data: null,
      source: "mock",
      notice: "관리자 세션이 없어 계약 정보를 불러올 수 없습니다."
    };
  }

  try {
    const data = await client.getRiderBikeContract(contractId);
    return { contractId, data, source: "service-ops" };
  } catch (error) {
    return {
      contractId,
      data: null,
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
