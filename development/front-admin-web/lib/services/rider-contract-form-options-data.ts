import {
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

export type RiderContractFormOption = {
  value: string;
  label: string;
  helper?: string;
};

export type RiderContractFormOptionsResult = {
  vehicles: RiderContractFormOption[];
  templates: RiderContractFormOption[];
  notice?: string;
};

/**
 * Loader for the rider-scoped contract create form. Returns the vehicle
 * and contract template selection options - rider is excluded because
 * it is bound from the URL on the rider-scoped contract page. Mirrors
 * the option-loader pattern used elsewhere (e.g. loadInsuranceOptions)
 * so the form component can stay purely presentational.
 */
export async function loadRiderContractFormOptions(): Promise<RiderContractFormOptionsResult> {
  if (!serviceOpsApiConfigured()) {
    return { vehicles: [], templates: [] };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      vehicles: [],
      templates: [],
      notice: "관리자 세션이 없어 차량/계약 양식 선택지를 가져올 수 없습니다."
    };
  }

  try {
    const [vehiclePage, templatePage] = await Promise.all([
      client.listVehicles({ page: 0, size: 200 }),
      client.listContractTemplates({ page: 0, size: 200 })
    ]);
    const vehicles: RiderContractFormOption[] = vehiclePage.items.map((vehicle) => ({
      value: vehicle.id ?? vehicle.slug,
      label: `${vehicle.plateNumber} · ${vehicle.model}`,
      helper: vehicle.status
    }));
    const templates: RiderContractFormOption[] = templatePage.items
      .filter((template) => template.enabled)
      .map((template) => ({
        value: template.id,
        label: template.name,
        helper: template.description ?? undefined
      }));
    return { vehicles, templates };
  } catch (error) {
    return {
      vehicles: [],
      templates: [],
      notice: `선택지 조회 실패.${formatServiceOpsError(error)}`
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
