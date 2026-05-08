import {
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

import type { ContractTemplateFormInsuranceOption } from "@/components/contract-templates/ContractTemplateForm";

export type InsuranceOptionsResult = {
  options: ContractTemplateFormInsuranceOption[];
  notice?: string;
};

/**
 * Loads the active insurance items as a flat option list for the contract
 * template form's `defaultInsuranceItemId` select. Pages 200 rows on the
 * assumption that the operator catalog stays small; if the catalog grows
 * the form should switch to a typeahead.
 */
export async function loadInsuranceOptions(): Promise<InsuranceOptionsResult> {
  if (!serviceOpsApiConfigured()) {
    return {
      options: [],
      notice: "SERVICE_OPS_API_BASE_URL이 없어 보험 항목 목록을 가져올 수 없습니다."
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      options: [],
      notice: "관리자 세션이 없어 보험 항목 목록을 가져올 수 없습니다."
    };
  }

  try {
    const page = await client.listInsuranceItems({ page: 0, size: 200 });
    const options = page.items
      .filter((item) => item.enabled)
      .map((item) => ({
        id: item.id,
        name: item.name,
        // \`category\` is optional because the backend only attaches it after
        // Slice B; older rows fall back to "기타" so the select stays usable.
        category:
          (item as { category?: string }).category ??
          "기타"
      }));
    return { options };
  } catch (error) {
    return {
      options: [],
      notice: `보험 항목 목록 조회 실패.${formatServiceOpsError(error)}`
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
