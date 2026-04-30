import type { InsurancePolicy } from "@/types/domain";
import type { FrontendRider, ServiceOpsInsuranceItem, ServiceOpsRiderInsurance } from "./service-ops-api";

export type InsuranceDataResult = {
  policies: InsurancePolicy[];
  notice?: string;
  source: "mock" | "service-ops";
};

export type InsuranceDetailResult = {
  policy: InsurancePolicy;
  notice?: string;
  source: "mock" | "service-ops";
};

export type InsuranceLookup = {
  riders: Map<string, Pick<FrontendRider, "area" | "name" | "phone">>;
  items: Map<string, Pick<ServiceOpsInsuranceItem, "enabled" | "id" | "name">>;
};

export function toFrontendInsurancePolicy(policy: ServiceOpsRiderInsurance, lookup: InsuranceLookup): InsurancePolicy {
  const rider = lookup.riders.get(policy.riderId);
  const item = lookup.items.get(policy.insuranceItemId);

  return {
    createdAt: policy.createdAt,
    enabled: policy.enabled,
    endsAt: "보험기간 후속",
    holderLabel: rider ? `${rider.name} · ${rider.phone}` : "라이더 연결 확인 필요",
    id: policy.id,
    idx: policy.idx,
    insuranceItemId: policy.insuranceItemId,
    memo: policy.memo,
    policyNumber: "증권번호 후속",
    provider: item?.name ?? "보험 항목 연결 확인 필요",
    riderId: policy.riderId,
    slug: policy.id,
    source: "service-ops",
    startsAt: toDateOnly(policy.createdAt),
    status: deriveInsuranceStatus(policy.enabled),
    targetType: "라이더",
    updatedAt: policy.updatedAt
  };
}

export function deriveInsuranceStatus(enabled: boolean): InsurancePolicy["status"] {
  return enabled ? "정상" : "비활성";
}

export function mockInsuranceList(mockPolicies: InsurancePolicy[]): InsuranceDataResult {
  return {
    policies: mockPolicies.map((policy) => ({ ...policy, source: "mock" as const })),
    source: "mock"
  };
}

export function mockInsuranceDetail(slug: string, mockPolicies: InsurancePolicy[]): InsuranceDetailResult | null {
  const policy = mockPolicies.find((candidate) => candidate.slug === slug);
  if (!policy) {
    return null;
  }

  return {
    policy: { ...policy, source: "mock" },
    source: "mock"
  };
}

export function mockInsuranceUnavailableServiceDetail(
  slug: string,
  mockPolicies: InsurancePolicy[],
  notice: string
): InsuranceDetailResult | null {
  const exactFallback = mockInsuranceDetail(slug, mockPolicies);
  if (exactFallback) {
    return { ...exactFallback, notice };
  }

  if (!isUuidLike(slug) || !mockPolicies.length) {
    return null;
  }

  return {
    notice,
    policy: { ...mockPolicies[0], source: "mock" },
    source: "mock"
  };
}

export function mockInsuranceUnconfiguredServiceDetail(slug: string, mockPolicies: InsurancePolicy[]): InsuranceDetailResult | null {
  return mockInsuranceUnavailableServiceDetail(
    slug,
    mockPolicies,
    "SERVICE_OPS_API_BASE_URL이 없어 mock 보험 상세를 표시합니다. 백엔드 연결 후 실제 보험 상세로 전환됩니다."
  );
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toDateOnly(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}
