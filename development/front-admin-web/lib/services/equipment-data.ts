import {
  type FrontendVehicle,
  type ServiceOpsApiError,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import type { EquipmentType } from "@/types/domain";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import {
  bikeEquipments as mockBikeEquipments,
  equipmentTypes as mockEquipmentTypes,
  vehicles as mockVehicles
} from "@/lib/services/mock-data";
import {
  type BikeEquipmentDetailResult,
  type EquipmentDataResult,
  type EquipmentFormOptions,
  type EquipmentLookup,
  type EquipmentTypeDetailResult,
  isUuidLike,
  mockBikeEquipmentDetail,
  mockBikeEquipmentUnavailableServiceDetail,
  mockEquipmentData,
  mockEquipmentFormOptions,
  mockEquipmentTypeDetail,
  mockEquipmentTypeUnavailableServiceDetail,
  toEquipmentTypeList,
  toFrontendBikeEquipment
} from "@/lib/services/equipment-data-core";

export async function loadEquipmentData(): Promise<EquipmentDataResult> {
  const fallback = mockEquipmentData(mockEquipmentTypes, mockBikeEquipments);

  if (!serviceOpsApiConfigured()) {
    return {
      ...fallback,
      notice: "SERVICE_OPS_API_BASE_URL이 없어 mock 장비 데이터를 표시합니다. 백엔드 연결 시 서버 액션이 실제 API를 호출합니다."
    };
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return {
      ...fallback,
      notice: "서비스 API 세션 쿠키가 없어 mock 장비 데이터를 표시합니다. 관리자 로그인 후 실제 백엔드 목록으로 전환됩니다."
    };
  }

  try {
    const [equipmentTypesPage, bikeEquipmentsPage, vehiclesPage] = await Promise.all([
      client.listEquipmentTypes({ page: 0, size: 100 }),
      client.listBikeEquipments({ page: 0, size: 100 }),
      client.listVehicles({ page: 0, size: 100 })
    ]);
    const equipmentTypes = toEquipmentTypeList(equipmentTypesPage.items);
    const lookup = toEquipmentLookup(vehiclesPage.items, equipmentTypes);

    return {
      bikeEquipments: bikeEquipmentsPage.items.map((equipment) => toFrontendBikeEquipment(equipment, lookup)),
      equipmentTypes,
      source: "service-ops"
    };
  } catch (error) {
    return {
      ...fallback,
      notice: `서비스 API 장비 조회 실패로 mock 장비 데이터를 표시합니다.${formatServiceOpsError(error)}`
    };
  }
}

export async function loadBikeEquipmentDetail(slug: string): Promise<BikeEquipmentDetailResult | null> {
  const fallback = mockBikeEquipmentDetail(slug, mockBikeEquipments);

  if (!serviceOpsApiConfigured() && isUuidLike(slug)) {
    return mockBikeEquipmentUnavailableServiceDetail(
      slug,
      mockBikeEquipments,
      "SERVICE_OPS_API_BASE_URL이 없어 mock 장비 상세를 표시합니다. 백엔드 연결 후 실제 장비 상세로 전환됩니다."
    );
  }

  if (serviceOpsApiConfigured() && isUuidLike(slug)) {
    const client = await createAuthenticatedServiceOpsApiClient();

    if (!client) {
      return mockBikeEquipmentUnavailableServiceDetail(
        slug,
        mockBikeEquipments,
        "서비스 API 세션 쿠키가 없어 mock 장비 상세를 표시합니다. 관리자 로그인 후 실제 백엔드 상세로 전환됩니다."
      );
    }

    try {
      const [equipment, equipmentTypesPage, vehiclesPage] = await Promise.all([
        client.getBikeEquipment(slug),
        client.listEquipmentTypes({ page: 0, size: 100 }),
        client.listVehicles({ page: 0, size: 100 })
      ]);
      const equipmentTypes = toEquipmentTypeList(equipmentTypesPage.items);
      const lookup = toEquipmentLookup(vehiclesPage.items, equipmentTypes);
      return { equipment: toFrontendBikeEquipment(equipment, lookup), source: "service-ops" };
    } catch (error) {
      return mockBikeEquipmentUnavailableServiceDetail(
        slug,
        mockBikeEquipments,
        `서비스 API 장비 상세 조회 실패로 mock 장비 데이터를 표시합니다.${formatServiceOpsError(error)}`
      );
    }
  }

  return fallback;
}

export async function loadEquipmentTypeDetail(slug: string): Promise<EquipmentTypeDetailResult | null> {
  const fallback = mockEquipmentTypeDetail(slug, mockEquipmentTypes);

  if (!serviceOpsApiConfigured() && isUuidLike(slug)) {
    return mockEquipmentTypeUnavailableServiceDetail(
      slug,
      mockEquipmentTypes,
      "SERVICE_OPS_API_BASE_URL이 없어 mock 장비 종류 상세를 표시합니다. 백엔드 연결 후 실제 장비 종류 상세로 전환됩니다."
    );
  }

  if (serviceOpsApiConfigured() && isUuidLike(slug)) {
    const client = await createAuthenticatedServiceOpsApiClient();

    if (!client) {
      return mockEquipmentTypeUnavailableServiceDetail(
        slug,
        mockEquipmentTypes,
        "서비스 API 세션 쿠키가 없어 mock 장비 종류 상세를 표시합니다. 관리자 로그인 후 실제 백엔드 상세로 전환됩니다."
      );
    }

    try {
      const equipmentType = await client.getEquipmentType(slug);
      return { equipmentType: toEquipmentTypeList([equipmentType])[0], source: "service-ops" };
    } catch (error) {
      return mockEquipmentTypeUnavailableServiceDetail(
        slug,
        mockEquipmentTypes,
        `서비스 API 장비 종류 상세 조회 실패로 mock 데이터를 표시합니다.${formatServiceOpsError(error)}`
      );
    }
  }

  return fallback;
}

export async function loadEquipmentFormOptions(): Promise<EquipmentFormOptions> {
  const fallback = mockEquipmentFormOptions(mockVehicles, mockEquipmentTypes);

  if (!serviceOpsApiConfigured()) {
    return mockEquipmentFormOptions(
      mockVehicles,
      mockEquipmentTypes,
      "SERVICE_OPS_API_BASE_URL이 없어 mock 차량/장비 종류 선택지를 표시합니다."
    );
  }

  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) {
    return mockEquipmentFormOptions(
      mockVehicles,
      mockEquipmentTypes,
      "서비스 API 세션 쿠키가 없어 mock 차량/장비 종류 선택지를 표시합니다."
    );
  }

  try {
    const [vehiclesPage, typesPage] = await Promise.all([
      client.listVehicles({ page: 0, size: 100 }),
      client.listEquipmentTypes({ page: 0, size: 100 })
    ]);
    return {
      equipmentTypes: toEquipmentTypeList(typesPage.items).filter((type) => type.enabled),
      source: "service-ops",
      vehicles: vehiclesPage.items
    };
  } catch (error) {
    return mockEquipmentFormOptions(
      mockVehicles,
      mockEquipmentTypes,
      `서비스 API 선택지 조회 실패로 mock 선택지를 표시합니다.${formatServiceOpsError(error)}`
    );
  }
}

function toEquipmentLookup(
  vehicles: FrontendVehicle[],
  equipmentTypes: EquipmentType[]
): EquipmentLookup {
  return {
    equipmentTypes: new Map(equipmentTypes.map((type) => [type.id ?? type.slug, { name: type.name }])),
    vehicles: new Map(vehicles.map((vehicle) => [vehicle.id ?? vehicle.slug, { model: vehicle.model, plateNumber: vehicle.plateNumber, status: vehicle.status }]))
  };
}

function formatServiceOpsError(error: unknown): string {
  const serviceError = error as Partial<ServiceOpsApiError>;
  if (serviceError?.status) {
    return ` (${serviceError.status}${serviceError.code ? `/${serviceError.code}` : ""})`;
  }

  return "";
}
