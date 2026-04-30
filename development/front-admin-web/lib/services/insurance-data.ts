import type { InsurancePolicy } from "@/types/domain";
import type {
  FrontendRider,
  ServiceOpsApiClient,
  ServiceOpsApiError,
  ServiceOpsInsuranceItem
} from "@/lib/services/service-ops-api";
import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import { insurancePolicies as mockPolicies, riders as mockRiders } from "@/lib/services/mock-data";
import {
  type InsuranceDataResult,
  type InsuranceDetailResult,
  type InsuranceLookup,
  isUuidLike,
  mockInsuranceDetail,
  mockInsuranceList,
  mockInsuranceUnconfiguredServiceDetail,
  mockInsuranceUnavailableServiceDetail,
  toFrontendInsurancePolicy
} from "@/lib/services/insurance-data-core";

export type InsuranceSelectionOption = {
  label: string;
  value: string;
  helper?: string;
};

export type InsuranceFormOptionsResult = {
  items: InsuranceSelectionOption[];
  notice?: string;
  riders: InsuranceSelectionOption[];
  source: "mock" | "service-ops";
};

export async function loadInsuranceList(): Promise<InsuranceDataResult> {
  const fallback = mockInsuranceList(mockPolicies);

  if (!serviceOpsApiConfigured()) {
    return {
      ...fallback,
      notice: "SERVICE_OPS_API_BASE_URL이 없어 mock 보험 데이터를 표시합니다. 백엔드 연결 시 서버 액션이 실제 API를 호출합니다."
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      ...fallback,
      notice: "서비스 API 세션 쿠키가 없어 mock 보험 데이터를 표시합니다. 관리자 로그인 후 실제 백엔드 목록으로 전환됩니다."
    };
  }

  try {
    const [insurancePage, lookup] = await Promise.all([
      client.listRiderInsurances({ page: 0, size: 100 }),
      loadInsuranceLookup(client)
    ]);

    return {
      policies: insurancePage.items.map((policy) => toFrontendInsurancePolicy(policy, lookup)),
      source: "service-ops"
    };
  } catch (error) {
    return {
      ...fallback,
      notice: `서비스 API 보험 조회 실패로 mock 보험 데이터를 표시합니다.${formatServiceOpsError(error)}`
    };
  }
}

export async function loadInsuranceDetail(slug: string): Promise<InsuranceDetailResult | null> {
  const fallback = mockInsuranceDetail(slug, mockPolicies);

  if (!serviceOpsApiConfigured() && isUuidLike(slug)) {
    return mockInsuranceUnconfiguredServiceDetail(slug, mockPolicies);
  }

  if (serviceOpsApiConfigured() && isUuidLike(slug)) {
    const client = await createAuthenticatedServiceOpsApiClient();

    if (!client) {
      return mockInsuranceUnavailableServiceDetail(
        slug,
        mockPolicies,
        "서비스 API 세션 쿠키가 없어 mock 보험 상세를 표시합니다. 관리자 로그인 후 실제 백엔드 상세로 전환됩니다."
      );
    }

    try {
      const [policy, lookup] = await Promise.all([
        client.getRiderInsurance(slug),
        loadInsuranceLookup(client)
      ]);
      return {
        policy: toFrontendInsurancePolicy(policy, lookup),
        source: "service-ops"
      };
    } catch (error) {
      return mockInsuranceUnavailableServiceDetail(
        slug,
        mockPolicies,
        `서비스 API 보험 상세 조회 실패로 mock 보험 데이터를 표시합니다.${formatServiceOpsError(error)}`
      );
    }
  }

  return fallback;
}

export async function loadInsuranceFormOptions(): Promise<InsuranceFormOptionsResult> {
  const fallback = mockInsuranceFormOptions();

  if (!serviceOpsApiConfigured()) {
    return {
      ...fallback,
      notice: "SERVICE_OPS_API_BASE_URL이 없어 mock 선택지를 표시합니다. 백엔드 연결 후 실제 라이더/보험 항목 선택지로 전환됩니다."
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      ...fallback,
      notice: "서비스 API 세션 쿠키가 없어 mock 선택지를 표시합니다. 관리자 로그인 후 실제 선택지로 전환됩니다."
    };
  }

  try {
    const [riderPage, itemPage] = await Promise.all([
      client.listRiders({ page: 0, size: 100 }),
      client.listInsuranceItems({ page: 0, size: 100 })
    ]);

    return {
      items: itemPage.items
        .filter((item) => item.enabled)
        .map((item) => ({
          helper: item.description ?? undefined,
          label: item.name,
          value: item.id
        })),
      riders: riderPage.items.map((rider) => ({
        helper: `${rider.team} · ${rider.area}`,
        label: `${rider.name} · ${rider.phone}`,
        value: rider.slug
      })),
      source: "service-ops"
    };
  } catch (error) {
    return {
      ...fallback,
      notice: `서비스 API 선택지 조회 실패로 mock 선택지를 표시합니다.${formatServiceOpsError(error)}`
    };
  }
}

async function loadInsuranceLookup(client: ServiceOpsApiClient): Promise<InsuranceLookup> {
  const [riderPage, itemPage] = await Promise.all([
    client.listRiders({ page: 0, size: 100 }),
    client.listInsuranceItems({ page: 0, size: 100 })
  ]);

  return {
    items: new Map(itemPage.items.map((item: ServiceOpsInsuranceItem) => [item.id, item])),
    riders: new Map(riderPage.items.map((rider: FrontendRider) => [rider.slug, rider]))
  };
}

function mockInsuranceFormOptions(): InsuranceFormOptionsResult {
  const itemNames = Array.from(new Set(mockPolicies.filter((policy) => policy.targetType === "라이더").map((policy) => policy.provider)));

  return {
    items: itemNames.map((itemName) => ({
      helper: "mock 보험 항목",
      label: itemName,
      value: itemName
    })),
    riders: mockRiders.map((rider) => ({
      helper: `${rider.team} · ${rider.area}`,
      label: `${rider.name} · ${rider.phone}`,
      value: rider.slug
    })),
    source: "mock"
  };
}

function formatServiceOpsError(error: unknown): string {
  const serviceError = error as Partial<ServiceOpsApiError>;
  if (serviceError?.status) {
    return ` (${serviceError.status}${serviceError.code ? `/${serviceError.code}` : ""})`;
  }

  return "";
}
