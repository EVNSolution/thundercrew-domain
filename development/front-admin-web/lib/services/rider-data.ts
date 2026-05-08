import {
  type FrontendRider,
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import { contracts, insurancePolicies, riders as mockRiders } from "@/lib/services/mock-data";

export type RiderDataResult = {
  riders: FrontendRider[];
  source: "mock" | "service-ops";
  notice?: string;
};

export type RiderDetailResult = {
  rider: FrontendRider;
  source: "mock" | "service-ops";
  notice?: string;
  contracts: string[];
  insurance: string[];
};

export async function loadRiderList(): Promise<RiderDataResult> {
  const fallback = mockRiderList();

  if (!serviceOpsApiConfigured()) {
    return fallback;
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      ...fallback,
      notice: "서비스 API 세션 쿠키가 없어 mock 라이더 데이터를 표시합니다. 관리자 로그인 후 실제 백엔드 목록으로 전환됩니다."
    };
  }

  try {
    const page = await client.listRiders({ page: 0, size: 100 });
    return { riders: page.items, source: "service-ops" };
  } catch (error) {
    return {
      ...fallback,
      notice: `서비스 API 조회 실패로 mock 라이더 데이터를 표시합니다.${formatServiceOpsError(error)}`
    };
  }
}

export async function loadRiderDetail(slug: string): Promise<RiderDetailResult | null> {
  const fallback = mockRiderDetail(slug);

  if (serviceOpsApiConfigured() && isUuidLike(slug)) {
    const client = await createAuthenticatedServiceOpsApiClient();

    if (client) {
      try {
        const rider = await client.getRider(slug);
        return {
          contracts: ["계약 API 연결 후 표시"],
          insurance: ["보험 API 연결 후 표시"],
          rider,
          source: "service-ops"
        };
      } catch (error) {
        if (fallback) {
          return {
            ...fallback,
            notice: `서비스 API 상세 조회 실패로 mock 라이더 데이터를 표시합니다.${formatServiceOpsError(error)}`
          };
        }
      }
    }
  }

  if (fallback) {
    return fallback;
  }

  if (serviceOpsApiConfigured()) {
    return null;
  }

  return null;
}

export function mockRiderList(): RiderDataResult {
  return {
    riders: mockRiders.map((rider) => ({ ...rider, source: "mock" as const })),
    source: "mock"
  };
}

export function mockRiderConnections(riderName: string): Pick<RiderDetailResult, "contracts" | "insurance"> {
  return {
    contracts: contracts.filter((contract) => contract.riderName === riderName).map((contract) => contract.contractType),
    insurance: insurancePolicies
      .filter((policy) => policy.holderLabel.includes(riderName))
      .map((policy) => policy.provider)
  };
}

function mockRiderDetail(slug: string): RiderDetailResult | null {
  const rider = mockRiders.find((candidate) => candidate.slug === slug);

  if (!rider) {
    return null;
  }

  return {
    ...mockRiderConnections(rider.name),
    rider: { ...rider, source: "mock" },
    source: "mock"
  };
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatServiceOpsError(error: unknown): string {
  const serviceError = error as Partial<ServiceOpsApiError>;
  if (serviceError?.status) {
    return ` (${serviceError.status}${serviceError.code ? `/${serviceError.code}` : ""})`;
  }

  return "";
}
