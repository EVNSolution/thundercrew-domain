import type { RiderContract } from "@/types/domain";
import type {
  FrontendRider,
  FrontendVehicle,
  ServiceOpsApiClient,
  ServiceOpsApiError,
  ServiceOpsContractTemplate
} from "@/lib/services/service-ops-api";
import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import { contracts as mockContracts, riders as mockRiders, vehicles as mockVehicles } from "@/lib/services/mock-data";
import {
  type ContractDataResult,
  type ContractDetailResult,
  type ContractLookup,
  isUuidLike,
  mockContractDetail,
  mockContractList,
  mockContractUnconfiguredServiceDetail,
  mockContractUnavailableServiceDetail,
  toFrontendContract
} from "@/lib/services/contract-data-core";

export type ContractSelectionOption = {
  label: string;
  value: string;
  helper?: string;
};

export type ContractFormOptionsResult = {
  notice?: string;
  riders: ContractSelectionOption[];
  source: "mock" | "service-ops";
  templates: ContractSelectionOption[];
  vehicles: ContractSelectionOption[];
};

export async function loadContractList(): Promise<ContractDataResult> {
  const fallback = mockContractList(mockContracts);

  if (!serviceOpsApiConfigured()) {
    return {
      ...fallback,
      notice: "SERVICE_OPS_API_BASE_URL이 없어 mock 계약 데이터를 표시합니다. 백엔드 연결 시 서버 액션이 실제 API를 호출합니다."
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      ...fallback,
      notice: "서비스 API 세션 쿠키가 없어 mock 계약 데이터를 표시합니다. 관리자 로그인 후 실제 백엔드 목록으로 전환됩니다."
    };
  }

  try {
    const [contractPage, lookup] = await Promise.all([
      client.listRiderBikeContracts({ page: 0, size: 100 }),
      loadContractLookup(client)
    ]);

    return {
      contracts: contractPage.items.map((contract) => toFrontendContract(contract, lookup)),
      source: "service-ops"
    };
  } catch (error) {
    return {
      ...fallback,
      notice: `서비스 API 계약 조회 실패로 mock 계약 데이터를 표시합니다.${formatServiceOpsError(error)}`
    };
  }
}

export async function loadContractDetail(slug: string): Promise<ContractDetailResult | null> {
  const fallback = mockContractDetail(slug, mockContracts);

  if (!serviceOpsApiConfigured() && isUuidLike(slug)) {
    return mockContractUnconfiguredServiceDetail(slug, mockContracts);
  }

  if (serviceOpsApiConfigured() && isUuidLike(slug)) {
    const client = await createAuthenticatedServiceOpsApiClient();

    if (!client) {
      return mockContractUnavailableServiceDetail(
        slug,
        mockContracts,
        "서비스 API 세션 쿠키가 없어 mock 계약 상세를 표시합니다. 관리자 로그인 후 실제 백엔드 상세로 전환됩니다."
      );
    }

    try {
      const [contract, lookup] = await Promise.all([
        client.getRiderBikeContract(slug),
        loadContractLookup(client)
      ]);
      return {
        contract: toFrontendContract(contract, lookup),
        source: "service-ops"
      };
    } catch (error) {
      return mockContractUnavailableServiceDetail(
        slug,
        mockContracts,
        `서비스 API 계약 상세 조회 실패로 mock 계약 데이터를 표시합니다.${formatServiceOpsError(error)}`
      );
    }
  }

  return fallback;
}

export async function loadContractFormOptions(): Promise<ContractFormOptionsResult> {
  const fallback = mockContractFormOptions();

  if (!serviceOpsApiConfigured()) {
    return {
      ...fallback,
      notice: "SERVICE_OPS_API_BASE_URL이 없어 mock 선택지를 표시합니다. 백엔드 연결 후 실제 라이더/차량/계약 양식 선택지로 전환됩니다."
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
    const [riderPage, vehiclePage, templatePage] = await Promise.all([
      client.listRiders({ page: 0, size: 100 }),
      client.listVehicles({ page: 0, size: 100 }),
      client.listContractTemplates({ page: 0, size: 100 })
    ]);

    return {
      riders: riderPage.items.map((rider) => ({
        helper: `${rider.team} · ${rider.area}`,
        label: `${rider.name} · ${rider.phone}`,
        value: rider.slug
      })),
      source: "service-ops",
      templates: templatePage.items
        .filter((template) => template.enabled)
        .map((template) => ({
          helper: template.description ?? undefined,
          label: `${template.name} · ${formatDuration(template)}`,
          value: template.id
        })),
      vehicles: vehiclePage.items.map((vehicle) => ({
        helper: vehicle.status,
        label: `${vehicle.plateNumber} · ${vehicle.model}`,
        value: vehicle.slug
      }))
    };
  } catch (error) {
    return {
      ...fallback,
      notice: `서비스 API 선택지 조회 실패로 mock 선택지를 표시합니다.${formatServiceOpsError(error)}`
    };
  }
}

async function loadContractLookup(client: ServiceOpsApiClient): Promise<ContractLookup> {
  const [riderPage, vehiclePage, templatePage] = await Promise.all([
    client.listRiders({ page: 0, size: 100 }),
    client.listVehicles({ page: 0, size: 100 }),
    client.listContractTemplates({ page: 0, size: 100 })
  ]);

  return {
    riders: new Map(riderPage.items.map((rider: FrontendRider) => [rider.slug, rider])),
    templates: new Map(templatePage.items.map((template: ServiceOpsContractTemplate) => [template.id, template])),
    vehicles: new Map(vehiclePage.items.map((vehicle: FrontendVehicle) => [vehicle.slug, vehicle]))
  };
}

function mockContractFormOptions(): ContractFormOptionsResult {
  const templateNames = Array.from(new Set(mockContracts.map((contract) => contract.contractType)));

  return {
    riders: mockRiders.map((rider) => ({
      helper: `${rider.team} · ${rider.area}`,
      label: `${rider.name} · ${rider.phone}`,
      value: rider.slug
    })),
    source: "mock",
    templates: templateNames.map((templateName) => ({
      helper: "mock 계약 양식",
      label: templateName,
      value: templateName
    })),
    vehicles: mockVehicles.map((vehicle) => ({
      helper: vehicle.status,
      label: `${vehicle.plateNumber} · ${vehicle.model}`,
      value: vehicle.slug
    }))
  };
}

function formatDuration(template: ServiceOpsContractTemplate): string {
  if (template.unlimited || template.durationMinutes === null) {
    return "무제한";
  }

  if (template.durationMinutes % 1440 === 0) {
    return `${template.durationMinutes / 1440}일`;
  }

  if (template.durationMinutes % 60 === 0) {
    return `${template.durationMinutes / 60}시간`;
  }

  return `${template.durationMinutes}분`;
}

function formatServiceOpsError(error: unknown): string {
  const serviceError = error as Partial<ServiceOpsApiError>;
  if (serviceError?.status) {
    return ` (${serviceError.status}${serviceError.code ? `/${serviceError.code}` : ""})`;
  }

  return "";
}
