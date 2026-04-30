import type { BikeEquipment, EquipmentManagementStatus, EquipmentType } from "@/types/domain";
import type {
  FrontendVehicle,
  ServiceOpsBikeEquipment,
  ServiceOpsBikeEquipmentManagementStatus,
  ServiceOpsEquipmentType
} from "./service-ops-api";

export type EquipmentDataResult = {
  source: "mock" | "service-ops";
  equipmentTypes: EquipmentType[];
  bikeEquipments: BikeEquipment[];
  notice?: string;
};

export type BikeEquipmentDetailResult = {
  source: "mock" | "service-ops";
  equipment: BikeEquipment;
  notice?: string;
};

export type EquipmentTypeDetailResult = {
  source: "mock" | "service-ops";
  equipmentType: EquipmentType;
  notice?: string;
};

export type EquipmentFormOptions = {
  source: "mock" | "service-ops";
  vehicles: Array<Pick<FrontendVehicle, "model" | "plateNumber" | "slug" | "status">>;
  equipmentTypes: EquipmentType[];
  notice?: string;
};

export type EquipmentLookup = {
  vehicles: Map<string, Pick<FrontendVehicle, "model" | "plateNumber" | "status">>;
  equipmentTypes: Map<string, Pick<EquipmentType, "name">>;
};

export function toFrontendBikeEquipment(equipment: ServiceOpsBikeEquipment, lookup: EquipmentLookup): BikeEquipment {
  const vehicle = lookup.vehicles.get(equipment.bikeId);
  const type = lookup.equipmentTypes.get(equipment.equipmentTypeId);
  const equipmentTypeName = type?.name ?? "장비 종류 연결 확인 필요";

  return {
    bikeId: equipment.bikeId,
    bikeLabel: vehicle ? `${vehicle.plateNumber} · ${vehicle.model}` : "차량 연결 확인 필요",
    equipmentLabel: equipment.equipmentLabel ?? equipmentTypeName,
    equipmentTypeId: equipment.equipmentTypeId,
    equipmentTypeName,
    id: equipment.id,
    idx: equipment.idx,
    installedAt: toDateTimeLabel(equipment.installedAt),
    managementDueDate: equipment.managementDueDate,
    managementNote: equipment.managementNote,
    managementStatus: equipment.removedAt ? "제거됨" : toFrontendManagementStatus(equipment.managementStatus),
    managementStatusCode: equipment.managementStatus,
    memo: equipment.memo,
    modelName: equipment.modelName,
    removedAt: equipment.removedAt,
    serialNumber: equipment.serialNumber,
    slug: equipment.id,
    source: "service-ops"
  };
}

export function toFrontendManagementStatus(status: ServiceOpsBikeEquipmentManagementStatus): EquipmentManagementStatus {
  switch (status) {
    case "NORMAL":
      return "정상";
    case "DUE_SOON":
      return "관리 예정";
    case "OVERDUE":
      return "기한 초과";
  }
}

export function toEquipmentTypeList(types: ServiceOpsEquipmentType[]): EquipmentType[] {
  return types.map((type) => ({
    createdAt: type.createdAt,
    description: type.description,
    enabled: type.enabled,
    id: type.id,
    idx: type.idx,
    name: type.name,
    slug: type.id,
    source: "service-ops" as const,
    updatedAt: type.updatedAt
  }));
}

export function mockEquipmentData(mockTypes: EquipmentType[], mockEquipments: BikeEquipment[]): EquipmentDataResult {
  return {
    bikeEquipments: mockEquipments.map((equipment) => ({ ...equipment, source: "mock" as const })),
    equipmentTypes: mockTypes.map((type) => ({ ...type, source: "mock" as const })),
    source: "mock"
  };
}

export function mockBikeEquipmentDetail(slug: string, mockEquipments: BikeEquipment[]): BikeEquipmentDetailResult | null {
  const equipment = mockEquipments.find((candidate) => candidate.slug === slug);
  if (!equipment) {
    return null;
  }

  return {
    equipment: { ...equipment, source: "mock" },
    source: "mock"
  };
}

export function mockEquipmentTypeDetail(slug: string, mockTypes: EquipmentType[]): EquipmentTypeDetailResult | null {
  const equipmentType = mockTypes.find((candidate) => candidate.slug === slug);
  if (!equipmentType) {
    return null;
  }

  return {
    equipmentType: { ...equipmentType, source: "mock" },
    source: "mock"
  };
}

export function mockBikeEquipmentUnavailableServiceDetail(
  slug: string,
  mockEquipments: BikeEquipment[],
  notice: string
): BikeEquipmentDetailResult | null {
  const exactFallback = mockBikeEquipmentDetail(slug, mockEquipments);
  if (exactFallback) {
    return { ...exactFallback, notice };
  }

  if (!isUuidLike(slug) || !mockEquipments.length) {
    return null;
  }

  return {
    equipment: { ...mockEquipments[0], source: "mock" },
    notice,
    source: "mock"
  };
}

export function mockEquipmentTypeUnavailableServiceDetail(
  slug: string,
  mockTypes: EquipmentType[],
  notice: string
): EquipmentTypeDetailResult | null {
  const exactFallback = mockEquipmentTypeDetail(slug, mockTypes);
  if (exactFallback) {
    return { ...exactFallback, notice };
  }

  if (!isUuidLike(slug) || !mockTypes.length) {
    return null;
  }

  return {
    equipmentType: { ...mockTypes[0], source: "mock" },
    notice,
    source: "mock"
  };
}

export function mockEquipmentFormOptions(
  vehicles: Array<Pick<FrontendVehicle, "model" | "plateNumber" | "slug" | "status">>,
  equipmentTypes: EquipmentType[],
  notice?: string
): EquipmentFormOptions {
  return {
    equipmentTypes: equipmentTypes.map((type) => ({ ...type, source: "mock" as const })),
    notice,
    source: "mock",
    vehicles: vehicles.map((vehicle) => ({ ...vehicle }))
  };
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
