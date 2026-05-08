import { contractTemplates as mockContractTemplates } from "@/lib/services/mock-data";
import { serviceOpsApiConfigured, type ServiceOpsApiError } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import {
  type ContractTemplateDataResult,
  type ContractTemplateDetailResult,
  isUuidLike,
  mockContractTemplateDetail,
  mockContractTemplateList,
  mockContractTemplateUnavailableServiceDetail,
  toFrontendContractTemplate
} from "@/lib/services/contract-template-data-core";

export async function loadContractTemplateList(): Promise<ContractTemplateDataResult> {
  const fallback = mockContractTemplateList(mockContractTemplates);

  if (!serviceOpsApiConfigured()) {
    return fallback;
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      ...fallback,
      notice: "서비스 API 세션 쿠키가 없어 mock 계약 양식을 표시합니다. 관리자 로그인 후 실제 백엔드 목록으로 전환됩니다."
    };
  }

  try {
    const page = await client.listContractTemplates({ page: 0, size: 100 });
    return {
      source: "service-ops",
      templates: page.items.map(toFrontendContractTemplate)
    };
  } catch (error) {
    return {
      ...fallback,
      notice: `서비스 API 계약 양식 조회 실패로 mock 계약 양식을 표시합니다.${formatServiceOpsError(error)}`
    };
  }
}

export async function loadContractTemplateDetail(slug: string): Promise<ContractTemplateDetailResult | null> {
  const fallback = mockContractTemplateDetail(slug, mockContractTemplates);

  if (!serviceOpsApiConfigured() && isUuidLike(slug)) {
    return mockContractTemplateUnavailableServiceDetail(slug, mockContractTemplates, "");
  }

  if (serviceOpsApiConfigured() && isUuidLike(slug)) {
    const client = await createAuthenticatedServiceOpsApiClient();

    if (!client) {
      return mockContractTemplateUnavailableServiceDetail(
        slug,
        mockContractTemplates,
        "서비스 API 세션 쿠키가 없어 mock 계약 양식 상세를 표시합니다. 관리자 로그인 후 실제 상세로 전환됩니다."
      );
    }

    try {
      return {
        source: "service-ops",
        template: toFrontendContractTemplate(await client.getContractTemplate(slug))
      };
    } catch (error) {
      return mockContractTemplateUnavailableServiceDetail(
        slug,
        mockContractTemplates,
        `서비스 API 계약 양식 상세 조회 실패로 mock 계약 양식 상세를 표시합니다.${formatServiceOpsError(error)}`
      );
    }
  }

  return fallback;
}

function formatServiceOpsError(error: unknown): string {
  const serviceError = error as Partial<ServiceOpsApiError>;
  if (serviceError?.status) {
    return ` (${serviceError.status}${serviceError.code ? `/${serviceError.code}` : ""})`;
  }

  return "";
}
