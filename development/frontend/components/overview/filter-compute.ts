import type {
  FrontendDashboardBikePin,
  FrontendRider,
  FrontendVehicle,
  ServiceOpsBikeOperationStatus,
  ServiceOpsRiderEducationType
} from "@/lib/services/service-ops-api";
import type { RiderActiveContractSummary } from "@/lib/services/rider-matching-snapshot-data";
import type { VehicleMaintenanceSummary } from "@/components/management/vehicle-maintenance-derive";

/**
 * 차량 / 라이더 / BSS 세 패널 + 풀스크린 지도 오버레이가 공유하는 필터
 * 정의 + pure 컴퓨테이션 헬퍼. 패널들이 자기 useState 로 들고 있던 로직을
 * 그대로 옮긴 거라 동일 입력 → 동일 출력 (회귀 방지).
 */

export type VehicleFilterState = {
  query: string;
  engineType: "ALL" | "ELECTRIC" | "ICE";
  operationStatus: "ALL" | "READY" | "IN_SERVICE";
  connection: "ALL" | "ONLINE" | "ANY_OFFLINE";
  ignition: "ALL" | "ON" | "OFF";
  maintenance: "ALL" | "DUE_SOON" | "OVERDUE" | "ANY";
};

export const DEFAULT_VEHICLE_FILTERS: VehicleFilterState = {
  query: "",
  engineType: "ALL",
  operationStatus: "ALL",
  connection: "ALL",
  ignition: "ALL",
  maintenance: "ALL"
};

export type RiderFilterState = {
  query: string;
  education: "ALL" | "ONLINE" | "OFFLINE" | "NONE";
  assignment: "ALL" | "ASSIGNED" | "UNASSIGNED";
  contractCategory: "ALL" | "SUBSCRIPTION" | "RENTAL" | "CUSTOM";
  insurance: "ALL" | "HAS" | "NONE";
  ignition: "ALL" | "ON" | "OFF" | "UNASSIGNED";
};

export const DEFAULT_RIDER_FILTERS: RiderFilterState = {
  query: "",
  education: "ALL",
  assignment: "ALL",
  contractCategory: "ALL",
  insurance: "ALL",
  ignition: "ALL"
};



/** BSS 재고 부족 임계값 — 가용 / 최대 ≤ 30% 면 부족. 옛 `StationsPanel.LOW_STOCK_RATIO`. */
export const LOW_STOCK_RATIO = 0.3;

export function statusToOperation(status: FrontendVehicle["status"]): ServiceOpsBikeOperationStatus {
  return status === "운행" ? "IN_SERVICE" : "READY";
}



/**
 * 차량 필터 적용. 옛 `VehiclesPanel.tsx:139-188` 와 동일 로직.
 */
export function applyVehicleFilters(input: {
  vehicles: ReadonlyArray<FrontendVehicle>;
  filters: VehicleFilterState;
  bikePinById: Map<string, FrontendDashboardBikePin>;
  maintenanceSummaryByBike?: Map<string, VehicleMaintenanceSummary>;
}): FrontendVehicle[] {
  const { vehicles, filters, bikePinById, maintenanceSummaryByBike } = input;
  const q = filters.query.trim().toLowerCase();
  return vehicles.filter((vehicle) => {
    const vehicleKey = vehicle.id ?? vehicle.slug;
    if (q) {
      const plateMatch = vehicle.plateNumber.toLowerCase().includes(q);
      const modelMatch = (vehicle.model ?? "").toLowerCase().includes(q);
      const imei = vehicle.imei ?? "";
      const imeiMatch = imei.toLowerCase().includes(q);
      if (!plateMatch && !modelMatch && !imeiMatch) return false;
    }
    if (filters.engineType !== "ALL") {
      const et = vehicle.engineType ?? "ELECTRIC";
      if (et !== filters.engineType) return false;
    }
    if (filters.operationStatus !== "ALL") {
      const op = vehicle.operationStatus ?? statusToOperation(vehicle.status);
      if (op !== filters.operationStatus) return false;
    }
    if (filters.connection !== "ALL") {
      const pin = bikePinById.get(vehicleKey);
      const status = pin?.connectionStatus;
      if (filters.connection === "ONLINE") {
        if (status !== "ONLINE") return false;
      } else {
        if (status === "ONLINE") return false;
      }
    }
    if (filters.ignition !== "ALL") {
      const pin = bikePinById.get(vehicleKey);
      const status = pin?.ignitionStatus;
      if (filters.ignition === "ON" && status !== "ON") return false;
      if (filters.ignition === "OFF" && status === "ON") return false;
    }
    if (filters.maintenance !== "ALL") {
      const summary = maintenanceSummaryByBike?.get(vehicleKey);
      if (!summary) return false;
      if (filters.maintenance === "OVERDUE" && !summary.hasOverdue) return false;
      if (filters.maintenance === "DUE_SOON" && !summary.hasDueSoon) return false;
      if (filters.maintenance === "ANY" && !summary.hasOverdue && !summary.hasDueSoon) return false;
    }
    return true;
  });
}

/**
 * 라이더 필터 적용. 옛 `RidersPanel.tsx:93-147` 와 동일 로직.
 */
export function applyRiderFilters(input: {
  riders: ReadonlyArray<FrontendRider>;
  filters: RiderFilterState;
  educationTypeByRiderId?: Map<string, ServiceOpsRiderEducationType>;
  riderActiveBikeId?: Map<string, string>;
  riderActiveBikePlate?: Map<string, string>;
  riderActiveContractById?: Map<string, RiderActiveContractSummary>;
  insuredRiderIds?: ReadonlySet<string>;
  ignitionStatusByBikeId?: Map<string, string>;
}): FrontendRider[] {
  const {
    riders,
    filters,
    educationTypeByRiderId,
    riderActiveBikeId,
    riderActiveBikePlate,
    riderActiveContractById,
    insuredRiderIds,
    ignitionStatusByBikeId
  } = input;
  const q = filters.query.trim().toLowerCase();
  return riders.filter((rider) => {
    const riderKey = rider.id ?? rider.slug;
    if (q) {
      const nameMatch = rider.name.toLowerCase().includes(q);
      const phoneMatch = rider.phone.toLowerCase().includes(q);
      const plate = riderActiveBikePlate?.get(riderKey) ?? "";
      const plateMatch = plate.toLowerCase().includes(q);
      if (!nameMatch && !phoneMatch && !plateMatch) return false;
    }
    if (filters.education !== "ALL") {
      const eduType = educationTypeByRiderId?.get(riderKey) ?? null;
      if (filters.education === "NONE" && eduType !== null) return false;
      if ((filters.education === "ONLINE" || filters.education === "OFFLINE") && eduType !== filters.education) return false;
    }
    if (filters.assignment !== "ALL") {
      const hasBike = Boolean(riderActiveBikeId?.get(riderKey));
      if (filters.assignment === "ASSIGNED" && !hasBike) return false;
      if (filters.assignment === "UNASSIGNED" && hasBike) return false;
    }
    if (filters.contractCategory !== "ALL") {
      const category = riderActiveContractById?.get(riderKey)?.category ?? null;
      if (category !== filters.contractCategory) return false;
    }
    if (filters.insurance !== "ALL") {
      const has = insuredRiderIds?.has(riderKey) ?? false;
      if (filters.insurance === "HAS" && !has) return false;
      if (filters.insurance === "NONE" && has) return false;
    }
    if (filters.ignition !== "ALL") {
      const activeBikeId = riderActiveBikeId?.get(riderKey) ?? null;
      if (filters.ignition === "UNASSIGNED") {
        if (activeBikeId) return false;
      } else {
        if (!activeBikeId) return false;
        const status = ignitionStatusByBikeId?.get(activeBikeId);
        if (filters.ignition === "ON" && status !== "ON") return false;
        if (filters.ignition === "OFF" && status === "ON") return false;
      }
    }
    return true;
  });
}

