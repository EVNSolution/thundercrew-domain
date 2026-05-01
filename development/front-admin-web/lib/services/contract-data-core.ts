import type { RiderContract } from "@/types/domain";
import type {
  FrontendRider,
  FrontendVehicle,
  ServiceOpsContractTemplate,
  ServiceOpsRiderBikeContract
} from "./service-ops-api";

export type ContractDataResult = {
  contracts: RiderContract[];
  notice?: string;
  source: "mock" | "service-ops";
};

export type ContractDetailResult = {
  contract: RiderContract;
  notice?: string;
  source: "mock" | "service-ops";
};

export type ContractLookup = {
  riders: Map<string, Pick<FrontendRider, "area" | "name" | "phone">>;
  vehicles: Map<string, Pick<FrontendVehicle, "model" | "plateNumber" | "status">>;
  templates: Map<string, Pick<ServiceOpsContractTemplate, "durationMinutes" | "enabled" | "id" | "name" | "unlimited">>;
};

export function toFrontendContract(
  contract: ServiceOpsRiderBikeContract,
  lookup: ContractLookup,
  now = new Date()
): RiderContract {
  const rider = lookup.riders.get(contract.riderId);
  const vehicle = lookup.vehicles.get(contract.bikeId);
  const template = lookup.templates.get(contract.contractTemplateId);

  const riderName = rider?.name ?? "라이더 연결 확인 필요";
  const bikeLabel = vehicle ? `${vehicle.plateNumber} · ${vehicle.model}` : "차량 연결 확인 필요";
  const templateName = template?.name ?? "계약 양식 연결 확인 필요";

  return {
    area: rider?.area ?? "미지정",
    bikeId: contract.bikeId,
    bikeLabel,
    contractTemplateId: contract.contractTemplateId,
    contractType: templateName,
    createdAt: contract.createdAt,
    endAt: contract.endAt,
    endsAt: contract.endAt ? toDateTimeLabel(contract.endAt) : "무제한",
    id: contract.id,
    idx: contract.idx,
    memo: contract.memo,
    riderId: contract.riderId,
    riderLabel: rider ? `${rider.name} · ${rider.phone}` : riderName,
    riderName,
    slug: contract.id,
    source: "service-ops",
    startAt: contract.startAt,
    startsAt: toDateTimeLabel(contract.startAt),
    status: deriveContractStatus(contract, now),
    templateName,
    terminatedAt: contract.terminatedAt,
    terminatedReason: contract.terminatedReason,
    updatedAt: contract.updatedAt
  };
}

export function deriveContractStatus(
  contract: Pick<ServiceOpsRiderBikeContract, "endAt" | "terminatedAt">,
  now = new Date()
): RiderContract["status"] {
  if (contract.terminatedAt) {
    return "종료";
  }

  if (!contract.endAt) {
    return "활성";
  }

  const endAt = new Date(contract.endAt);
  if (Number.isNaN(endAt.getTime())) {
    return "활성";
  }

  if (endAt.getTime() < now.getTime()) {
    return "종료";
  }

  const expiresSoonMs = 60 * 24 * 60 * 60 * 1000;
  return endAt.getTime() - now.getTime() <= expiresSoonMs ? "만료 예정" : "활성";
}

export function mockContractList(mockContracts: RiderContract[]): ContractDataResult {
  return {
    contracts: mockContracts.map((contract) => ({ ...contract, source: "mock" as const })),
    source: "mock"
  };
}

export function mockContractDetail(slug: string, mockContracts: RiderContract[]): ContractDetailResult | null {
  const contract = mockContracts.find((candidate) => candidate.slug === slug);
  if (!contract) {
    return null;
  }

  return {
    contract: { ...contract, source: "mock" },
    source: "mock"
  };
}

export function mockContractUnavailableServiceDetail(
  slug: string,
  mockContracts: RiderContract[],
  notice: string
): ContractDetailResult | null {
  const exactFallback = mockContractDetail(slug, mockContracts);
  if (exactFallback) {
    return { ...exactFallback, notice };
  }

  if (!isUuidLike(slug) || !mockContracts.length) {
    return null;
  }

  return {
    contract: { ...mockContracts[0], source: "mock" },
    notice,
    source: "mock"
  };
}

export function mockContractUnconfiguredServiceDetail(slug: string, mockContracts: RiderContract[]): ContractDetailResult | null {
  return mockContractUnavailableServiceDetail(
    slug,
    mockContracts,
    "SERVICE_OPS_API_BASE_URL이 없어 mock 계약 상세를 표시합니다. 백엔드 연결 후 실제 계약 상세로 전환됩니다."
  );
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toDateTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}
