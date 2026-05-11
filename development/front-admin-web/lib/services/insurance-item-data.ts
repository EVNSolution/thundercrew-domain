import { insuranceItems as mockInsuranceItems } from "@/lib/services/mock-data";
import { serviceOpsApiConfigured, type ServiceOpsApiError } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import {
  type InsuranceItemDataResult,
  type InsuranceItemDetailResult,
  isUuidLike,
  mockInsuranceItemDetail,
  mockInsuranceItemList,
  mockInsuranceItemUnavailableServiceDetail,
  toFrontendInsuranceItem
} from "@/lib/services/insurance-item-data-core";

export async function loadInsuranceItemList(): Promise<InsuranceItemDataResult> {
  const fallback = mockInsuranceItemList(mockInsuranceItems);

  if (!serviceOpsApiConfigured()) {
    return fallback;
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      ...fallback,
      notice: "서비스 API 세션 쿠키가 없어 mock 보험 항목을 표시합니다. 관리자 로그인 후 실제 백엔드 목록으로 전환됩니다."
    };
  }

  try {
    const page = await client.listInsuranceItems({ page: 0, size: 100 });
    return {
      items: page.items.map(toFrontendInsuranceItem),
      source: "service-ops"
    };
  } catch (error) {
    return {
      ...fallback,
      notice: `서비스 API 보험 항목 조회 실패로 mock 보험 항목을 표시합니다.${formatServiceOpsError(error)}`
    };
  }
}

export async function loadInsuranceItemDetail(slug: string): Promise<InsuranceItemDetailResult | null> {
  const fallback = mockInsuranceItemDetail(slug, mockInsuranceItems);

  if (!serviceOpsApiConfigured() && isUuidLike(slug)) {
    return mockInsuranceItemUnavailableServiceDetail(slug, mockInsuranceItems, "");
  }

  if (serviceOpsApiConfigured() && isUuidLike(slug)) {
    const client = await createAuthenticatedServiceOpsApiClient();

    if (!client) {
      return mockInsuranceItemUnavailableServiceDetail(
        slug,
        mockInsuranceItems,
        "서비스 API 세션 쿠키가 없어 mock 보험 항목 상세를 표시합니다. 관리자 로그인 후 실제 상세로 전환됩니다."
      );
    }

    try {
      return {
        item: toFrontendInsuranceItem(await client.getInsuranceItem(slug)),
        source: "service-ops"
      };
    } catch (error) {
      return mockInsuranceItemUnavailableServiceDetail(
        slug,
        mockInsuranceItems,
        `서비스 API 보험 항목 상세 조회 실패로 mock 보험 항목 상세를 표시합니다.${formatServiceOpsError(error)}`
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
