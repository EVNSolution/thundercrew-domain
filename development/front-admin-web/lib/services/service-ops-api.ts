import type { BatteryStation, Device, EquipmentType } from "@/types/domain";

export type ServiceOpsFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type ServiceOpsPage<T> = {
  items: T[];
  page: {
    number: number;
    size: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

export type ServiceOpsAdminIdentity = {
  id: string;
  loginId: string;
  email: string | null;
  displayName: string;
  role: string;
};

export type ServiceOpsAuthResponse = {
  tokenType: string;
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  admin: ServiceOpsAdminIdentity;
};

export type ServiceOpsRiderTrainingStatus = "ONLINE" | "OFFLINE" | "INCOMPLETE";

export type ServiceOpsRider = {
  id: string;
  idx: number | null;
  name: string;
  phoneNumber: string;
  teamName: string | null;
  areaName: string | null;
  appAccountLinked: boolean;
  appAccountId: string | null;
  appLinkedAt: string | null;
  appLinkStatus: string;
  memo: string | null;
  trainingStatus?: ServiceOpsRiderTrainingStatus | null;
  createdAt: string;
  updatedAt: string;
};

export type FrontendRider = {
  slug: string;
  id?: string;
  idx?: number | null;
  name: string;
  phone: string;
  team: string;
  area: string;
  status: "활동" | "대기" | "휴면";
  joinedAt: string;
  trainingStatus?: ServiceOpsRiderTrainingStatus | null;
  appAccountLinked?: boolean;
  appAccountId?: string | null;
  appLinkedAt?: string | null;
  appLinkStatus?: string;
  memo?: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "mock" | "service-ops";
};

export type RiderCreateInput = {
  name: string;
  phoneNumber: string;
  teamName?: string | null;
  areaName?: string | null;
  memo?: string | null;
};

export type RiderUpdateInput = Partial<RiderCreateInput>;

export type ServiceOpsRiderEducationType = "ONLINE" | "OFFLINE";

export type ServiceOpsRiderEducationRecord = {
  id: string;
  idx: number | null;
  riderId: string;
  educationType: ServiceOpsRiderEducationType;
  courseName: string | null;
  completedAt: string;
  expiresAt: string | null;
  certificateNo: string | null;
  issuingAuthority: string | null;
  evidenceUrl: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RiderEducationRecordCreateInput = {
  riderId: string;
  educationType: ServiceOpsRiderEducationType;
  courseName?: string | null;
  completedAt: string;
  expiresAt?: string | null;
  certificateNo?: string | null;
  issuingAuthority?: string | null;
  evidenceUrl?: string | null;
  memo?: string | null;
};

export type RiderEducationRecordUpdateInput = {
  educationType?: ServiceOpsRiderEducationType;
  courseName?: string | null;
  completedAt?: string;
  expiresAt?: string | null;
  certificateNo?: string | null;
  issuingAuthority?: string | null;
  evidenceUrl?: string | null;
  memo?: string | null;
};

export type ServiceOpsBikeOperationStatus = "READY" | "IN_SERVICE";
export type ServiceOpsBikeWheelType = "TWO_WHEEL" | "FOUR_WHEEL";

/**
 * 차량 동력 종류. 정비 카탈로그 매칭과 운영자 필터의 1차 분류 키. backend
 * V21 마이그레이션으로 도입 — 기존 차량은 모두 `ELECTRIC` 으로 default.
 */
export type ServiceOpsBikeEngineType = "ELECTRIC" | "ICE";

export type ServiceOpsBikeServiceType = "CALL" | "SINGLE" | "SEQUENTIAL" | "ROUND" | "OTHER";

export type ServiceOpsBike = {
  id: string;
  idx: number | null;
  plateNumber: string;
  vin: string;
  modelName: string | null;
  /** Backend V21 부터 응답에 포함. 옛 backend 호환 위해 optional. */
  engineType?: ServiceOpsBikeEngineType;
  serviceType?: ServiceOpsBikeServiceType;
  operationStatus: ServiceOpsBikeOperationStatus;
  /** "시동 방지" 플래그. 라이더 상세 다이얼로그의 토글이 이 값을 PATCH 한다. */
  ignitionBlocked?: boolean;
  wheelType?: ServiceOpsBikeWheelType | null;
  imei?: string | null;
  terminalId?: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BikeIgnitionBlockInput = {
  blocked: boolean;
};

export type FrontendVehicle = {
  slug: string;
  id?: string;
  idx?: number | null;
  plateNumber: string;
  vin?: string | null;
  model: string;
  /** 정비 카탈로그 매칭에 쓰이는 동력 종류. 옛 backend 호환 위해 optional. */
  engineType?: ServiceOpsBikeEngineType;
  serviceType?: ServiceOpsBikeServiceType;
  wheelType?: ServiceOpsBikeWheelType | null;
  imei?: string | null;
  terminalId?: string | null;
  status: "운행" | "대기";
  operationStatus?: ServiceOpsBikeOperationStatus;
  /** 시동 방지 토글의 현재 상태. 백엔드가 응답에 포함; 없으면 false 로 간주. */
  ignitionBlocked?: boolean;
  assignmentStatus: string;
  batteryPercent: number | null;
  riderName?: string;
  locationLabel: string;
  lastSeenAt: string;
  memo?: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "mock" | "service-ops";
};

export type VehicleCreateInput = {
  plateNumber: string;
  vin?: string | null;
  modelName?: string | null;
  /** 미지정 시 backend 가 ELECTRIC 으로 기본값 (V21). */
  engineType?: ServiceOpsBikeEngineType;
  serviceType?: ServiceOpsBikeServiceType;
  operationStatus: ServiceOpsBikeOperationStatus;
  imei?: string | null;
  terminalId?: string | null;
  memo?: string | null;
};

export type VehicleUpdateInput = Partial<Omit<VehicleCreateInput, "operationStatus">>;

export type VehicleOperationStatusChangeInput = {
  operationStatus: ServiceOpsBikeOperationStatus;
  reason?: string | null;
  memo?: string | null;
};

export type ServiceOpsBikeOperationStatusHistory = {
  id: string;
  idx: number | null;
  bikeId: string;
  operationStatus: ServiceOpsBikeOperationStatus;
  startedAt: string;
  endedAt: string | null;
  reason: string | null;
  memo: string | null;
  changedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

// === 정비 도메인 (V22 backend 슬라이스) ===

export type ServiceOpsMaintenanceCategory =
  | "TWO_WHEEL_ELECTRIC"
  | "TWO_WHEEL_ICE"
  | "FOUR_WHEEL_ELECTRIC"
  | "FOUR_WHEEL_ICE";

export type ServiceOpsMaintenanceItem = {
  id: string;
  name: string;
  cycleKm: number | null;
  cycleMonths: number | null;
  alertThresholdPercent?: number | null;
  memo: string | null;
  categories: ServiceOpsMaintenanceCategory[];
};

export type ServiceOpsVehicleMaintenanceRecord = {
  id: string;
  idx: number | null;
  bikeId: string;
  itemId: string;
  servicedAt: string;
  servicedAtOdometerKm: number | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceRecordCreateInput = {
  itemId: string;
  servicedAt?: string | null;
  servicedAtOdometerKm?: number | null;
  memo?: string | null;
};

export type MaintenanceItemCreateInput = {
  name: string;
  categories: ServiceOpsMaintenanceCategory[];
  cycleKm?: number | null;
  cycleMonths?: number | null;
  alertThresholdPercent?: number | null;
  memo?: string | null;
};

export type MaintenanceItemUpdateInput = {
  name?: string | null;
  categories?: ServiceOpsMaintenanceCategory[];
  cycleKm?: number | null;
  cycleMonths?: number | null;
  alertThresholdPercent?: number | null;
  memo?: string | null;
};

export type ServiceOpsContractCategory = "SUBSCRIPTION" | "RENTAL" | "CUSTOM";
export type ServiceOpsContractReturnType = "TAKEOVER" | "RETURN";
export type ServiceOpsContractDurationUnit =
  | "DAY"
  | "WEEK"
  | "MONTH"
  | "QUARTER"
  | "HALF_YEAR"
  | "YEAR";

export type ServiceOpsContractTemplate = {
  id: string;
  idx: number | null;
  name: string;
  durationMinutes: number | null;
  unlimited: boolean;
  description: string | null;
  enabled: boolean;
  systemTemplate: boolean;
  category?: ServiceOpsContractCategory;
  returnType?: ServiceOpsContractReturnType | null;
  durationUnit?: ServiceOpsContractDurationUnit | null;
  durationValue?: number | null;
  includesInsurance?: boolean;
  defaultInsuranceItemId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContractTemplateCreateInput = {
  name: string;
  durationMinutes?: number | null;
  description?: string | null;
  enabled?: boolean | null;
  category?: ServiceOpsContractCategory;
  returnType?: ServiceOpsContractReturnType | null;
  durationUnit?: ServiceOpsContractDurationUnit | null;
  durationValue?: number | null;
  includesInsurance?: boolean | null;
  defaultInsuranceItemId?: string | null;
};

export type ContractTemplateUpdateInput = {
  name?: string | null;
  durationMinutes?: number | null;
  description?: string | null;
  enabled?: boolean | null;
  category?: ServiceOpsContractCategory;
  returnType?: ServiceOpsContractReturnType | null;
  durationUnit?: ServiceOpsContractDurationUnit | null;
  durationValue?: number | null;
  includesInsurance?: boolean | null;
  defaultInsuranceItemId?: string | null;
};

export type ServiceOpsAutoInsuranceSkipReason =
  | "TEMPLATE_NOT_OPTED_IN"
  | "DEFAULT_INSURANCE_ITEM_MISSING"
  | "DEFAULT_INSURANCE_ITEM_NOT_FOUND"
  | "DEFAULT_INSURANCE_ITEM_DELETED"
  | "DEFAULT_INSURANCE_ITEM_DISABLED"
  | "RIDER_INSURANCE_ALREADY_LINKED"
  | "RIDER_INSURANCE_DUPLICATE_ON_INSERT";

export type ServiceOpsRiderBikeContract = {
  id: string;
  idx: number | null;
  riderId: string;
  bikeId: string;
  contractTemplateId: string;
  startAt: string;
  endAt: string | null;
  terminatedAt: string | null;
  terminatedReason: string | null;
  memo: string | null;
  /**
   * Slice D: id of the rider_insurance row that the backend auto-issued from
   * the contract template's `default_insurance_item_id`. Stays {@code null}
   * for legacy contracts and for any code path that opted out / skipped the
   * issuance via {@link autoInsuranceSkipReason}.
   */
  autoIssuedRiderInsuranceId?: string | null;
  /** Slice D: short SKIP token explaining why automatic issuance did not run. */
  autoInsuranceSkipReason?: ServiceOpsAutoInsuranceSkipReason | null;
  /** Denormalized from Bike — populated in list responses. */
  plateNumber?: string | null;
  /** Denormalized from Rider — populated in list responses. */
  riderName?: string | null;
  riderPhoneNumber?: string | null;
  /** Denormalized from ContractTemplate — populated in list responses. */
  category?: ServiceOpsContractCategory | null;
  returnType?: ServiceOpsContractReturnType | null;
  /** Denormalized from Bike — populated in list responses. */
  serviceType?: ServiceOpsBikeServiceType | null;
  createdAt: string;
  updatedAt: string;
};

export type RiderBikeContractCreateInput = {
  riderId: string;
  bikeId: string;
  contractTemplateId: string;
  startAt: string;
  memo?: string | null;
};

export type RiderBikeContractUpdateInput = {
  memo?: string | null;
};

export type RiderBikeContractTerminateInput = {
  terminatedAt: string;
  terminatedReason?: string | null;
};

export type ServiceOpsInsuranceCategory = "PRIMARY" | "ADDON";
export type ServiceOpsInsuranceCoverageType =
  | "GENERAL_PAID_TRANSPORT"
  | "LIABILITY_PAID_TRANSPORT"
  | "HOURLY"
  | "ONE_DAY"
  | "OTHER";
export type ServiceOpsInsuranceDurationUnit =
  | "HOUR"
  | "DAY"
  | "WEEK"
  | "MONTH"
  | "QUARTER"
  | "HALF_YEAR"
  | "YEAR";

export type ServiceOpsInsuranceItem = {
  id: string;
  idx: number | null;
  name: string;
  description: string | null;
  enabled: boolean;
  category?: ServiceOpsInsuranceCategory;
  coverageType?: ServiceOpsInsuranceCoverageType | null;
  defaultDurationUnit?: ServiceOpsInsuranceDurationUnit | null;
  defaultDurationValue?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type InsuranceItemCreateInput = {
  name: string;
  description?: string | null;
  enabled?: boolean | null;
  category?: ServiceOpsInsuranceCategory;
  coverageType?: ServiceOpsInsuranceCoverageType | null;
  defaultDurationUnit?: ServiceOpsInsuranceDurationUnit | null;
  defaultDurationValue?: number | null;
};

export type InsuranceItemUpdateInput = {
  name?: string | null;
  description?: string | null;
  enabled?: boolean | null;
  category?: ServiceOpsInsuranceCategory;
  coverageType?: ServiceOpsInsuranceCoverageType | null;
  defaultDurationUnit?: ServiceOpsInsuranceDurationUnit | null;
  defaultDurationValue?: number | null;
};

export type ServiceOpsRiderInsurance = {
  id: string;
  idx: number | null;
  riderId: string;
  insuranceItemId: string;
  memo: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RiderInsuranceCreateInput = {
  riderId: string;
  insuranceItemId: string;
  memo?: string | null;
  enabled?: boolean | null;
  startsAt?: string | null;
  endsAt?: string | null;
  riderBikeContractId?: string | null;
};

export type RiderInsuranceUpdateInput = {
  memo?: string | null;
  enabled?: boolean | null;
};

export type ServiceOpsStationStatus = "ACTIVE" | "MAINTENANCE" | "INACTIVE";

export type ServiceOpsBatteryStation = {
  id: string;
  idx: number | null;
  name: string;
  address: string;
  latitude: number | string;
  longitude: number | string;
  status: ServiceOpsStationStatus;
  maxBatteryCapacity: number;
  currentBatteryCount: number;
  availableBatteryCount: number;
  availableBatteryLabel: string;
  capacityPercentage: number;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FrontendBatteryStation = BatteryStation;

export type BatteryStationCreateInput = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status: ServiceOpsStationStatus;
  maxBatteryCapacity: number;
  currentBatteryCount: number;
  availableBatteryCount: number;
  memo?: string | null;
};

export type BatteryStationUpdateInput = {
  name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: ServiceOpsStationStatus | null;
  memo?: string | null;
};

export type BatteryStationCountUpdateInput = {
  maxBatteryCapacity: number;
  currentBatteryCount: number;
  availableBatteryCount: number;
  reason?: string | null;
  memo?: string | null;
};

export type ServiceOpsStationBatteryCountLog = {
  id: string;
  idx: number | null;
  stationId: string;
  beforeMaxBatteryCapacity: number;
  afterMaxBatteryCapacity: number;
  beforeCurrentBatteryCount: number;
  afterCurrentBatteryCount: number;
  beforeAvailableBatteryCount: number;
  afterAvailableBatteryCount: number;
  reason: string | null;
  memo: string | null;
  changedAt: string;
  changedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceOpsEquipmentType = {
  id: string;
  idx: number | null;
  name: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EquipmentTypeCreateInput = {
  name: string;
  description?: string | null;
  enabled?: boolean | null;
};

export type EquipmentTypeUpdateInput = {
  name?: string | null;
  description?: string | null;
  enabled?: boolean | null;
};

export type ServiceOpsBikeEquipmentManagementStatus = "NORMAL" | "DUE_SOON" | "OVERDUE";

export type ServiceOpsBikeEquipment = {
  id: string;
  idx: number | null;
  bikeId: string;
  equipmentTypeId: string;
  equipmentLabel: string | null;
  modelName: string | null;
  serialNumber: string | null;
  installedAt: string;
  removedAt: string | null;
  managementDueDate: string;
  managementStatus: ServiceOpsBikeEquipmentManagementStatus;
  managementNote: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BikeEquipmentCreateInput = {
  bikeId: string;
  equipmentTypeId: string;
  equipmentLabel?: string | null;
  modelName?: string | null;
  serialNumber?: string | null;
  installedAt: string;
  managementDueDate: string;
  managementNote?: string | null;
  memo?: string | null;
};

export type BikeEquipmentUpdateInput = {
  equipmentLabel?: string | null;
  modelName?: string | null;
  serialNumber?: string | null;
  managementDueDate?: string | null;
  managementNote?: string | null;
  memo?: string | null;
};

export type BikeEquipmentRemoveInput = {
  removedAt?: string | null;
  memo?: string | null;
};

export type ServiceOpsDevice = {
  id: string;
  idx: number | null;
  deviceUid: string;
  manufacturer: string | null;
  modelName: string | null;
  enabled: boolean;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeviceCreateInput = {
  deviceUid: string;
  manufacturer?: string | null;
  modelName?: string | null;
  enabled?: boolean | null;
  memo?: string | null;
};

export type DeviceUpdateInput = {
  deviceUid?: string | null;
  manufacturer?: string | null;
  modelName?: string | null;
  enabled?: boolean | null;
  memo?: string | null;
};

export type ServiceOpsBikeDeviceInstallation = {
  id: string;
  idx: number | null;
  bikeId: string;
  deviceId: string;
  installedAt: string;
  removedAt: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BikeDeviceInstallationCreateInput = {
  bikeId: string;
  deviceId: string;
  installedAt: string;
  memo?: string | null;
};

export type BikeDeviceInstallationRemoveInput = {
  removedAt?: string | null;
  memo?: string | null;
};

export type ServiceOpsDashboardSummary = {
  totalBikes: number;
  bikePinCount: number;
  onlineBikeCount: number;
  signalLostBikeCount: number;
  parkedOfflineBikeCount: number;
  lowBatteryBikeCount: number;
  activeStationCount: number;
  stationPinCount: number;
  availableBatteryCount: number;
};

export type ServiceOpsDashboardBikePin = {
  bikeId: string;
  bikeIdx: number | null;
  plateNumber: string;
  modelName: string;
  operationStatus: string;
  activeRiderLabel: string | null;
  deviceId: string | null;
  lastReceivedAt: string;
  latitude: number | string;
  longitude: number | string;
  speedKph: number | string | null;
  batteryPercent: number | string | null;
  ignitionStatus: string;
  telemetrySource: string;
  drivingStatus: string;
  connectionStatus: string;
  batteryStatus: string;
  pinLabel: string;
  serviceType?: ServiceOpsBikeServiceType;
  wheelType?: ServiceOpsBikeWheelType;
  nextCustomerName?: string | null;
  nextCustomerPhone?: string | null;
  nextCustomerLat?: number | string | null;
  nextCustomerLng?: number | string | null;
  currentCustomerName?: string | null;
  currentCustomerPhone?: string | null;
  currentDispatchCustomerName?: string | null;
  currentDispatchAddress?: string | null;
  currentDispatchLatitude?: number | string | null;
  currentDispatchLongitude?: number | string | null;
  currentDispatchKind?: ServiceOpsDispatchOrderKind | null;
  dispatchQueueCount?: number | null;
};

export type ServiceOpsBikeNextCustomer = {
  bikeId: string;
  /** 다음 고객. promote() 후 null. */
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** 현재 고객. 아직 한 번도 이동 안 했으면 null. */
  currentCustomerName: string | null;
  currentCustomerPhone: string | null;
  currentCustomerAddress: string | null;
  currentCustomerLat: number | null;
  currentCustomerLng: number | null;
};

export type BikeNextCustomerUpsertInput = {
  customerName: string;
  customerPhone: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type ServiceOpsDashboardStationPin = {
  stationId: string;
  stationIdx: number | null;
  name: string;
  address: string;
  latitude: number | string;
  longitude: number | string;
  status: string;
  maxBatteryCapacity: number;
  currentBatteryCount: number;
  availableBatteryCount: number;
  availableBatteryLabel: string;
  availableBatteryPercentage: number;
  pinLabel: string;
};

export type ServiceOpsDashboardMapState = {
  generatedAt: string;
  summary: ServiceOpsDashboardSummary;
  bikePins: ServiceOpsDashboardBikePin[];
  stationPins: ServiceOpsDashboardStationPin[];
};

export type ServiceOpsIntegrityFindingCategory = "REFERENCE_NOT_FOUND" | "REFERENCE_DELETED";

export type ServiceOpsIntegritySummary = {
  category: ServiceOpsIntegrityFindingCategory;
  count: number;
};

export type ServiceOpsIntegrityFinding = {
  category: ServiceOpsIntegrityFindingCategory;
  sourceTable: string;
  sourceId: string;
  sourceIdx: number | null;
  referenceField: string;
  referenceId: string;
  targetTable: string;
  message: string;
};

export type ServiceOpsIntegrityScan = {
  generatedAt: string;
  totalFindings: number;
  summary: ServiceOpsIntegritySummary[];
  findings: ServiceOpsIntegrityFinding[];
};

export type FrontendDashboardBikePin = Omit<
  ServiceOpsDashboardBikePin,
  | "latitude"
  | "longitude"
  | "speedKph"
  | "batteryPercent"
  | "nextCustomerLat"
  | "nextCustomerLng"
  | "currentDispatchLatitude"
  | "currentDispatchLongitude"
  | "currentDispatchKind"
  | "dispatchQueueCount"
> & {
  slug: string;
  latitude: number;
  longitude: number;
  speedKph: number | null;
  batteryPercent: number | null;
  nextCustomerLat: number | null;
  nextCustomerLng: number | null;
  currentDispatchCustomerName: string | null;
  currentDispatchAddress: string | null;
  currentDispatchLatitude: number | null;
  currentDispatchLongitude: number | null;
  currentDispatchKind: ServiceOpsDispatchOrderKind | null;
  dispatchQueueCount: number;
};

export type FrontendDashboardStationPin = Omit<ServiceOpsDashboardStationPin, "latitude" | "longitude"> & {
  slug: string;
  latitude: number;
  longitude: number;
};

export interface FrontendTipPin {
  id: string;
  address: string;
  content: string;
  latitude: number;
  longitude: number;
}

export type FrontendDashboardMapState = {
  generatedAt: string;
  summary: ServiceOpsDashboardSummary;
  bikePins: FrontendDashboardBikePin[];
  stationPins: FrontendDashboardStationPin[];
  tips: FrontendTipPin[];
};

/**
 * 운영 팁(메모) 단건 — backend `TipReadResponse` 와 1:1.
 * lat/lng 는 JSON number, createdAt/updatedAt 은 ISO instant 문자열.
 */
export type ServiceOpsTip = {
  id: string;
  idx: number | null;
  address: string;
  content: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
};

/** 팁 생성 / 수정 공통 payload — backend create/update body 와 동일. */
export type TipUpsertPayload = {
  address: string;
  content: string;
  latitude: number;
  longitude: number;
};

export type ServiceOpsBikeCurrentState = {
  bikeId: string;
  deviceId: string | null;
  telemetryLogId: string | null;
  lastReceivedAt: string;
  latitude: number | string;
  longitude: number | string;
  speedKph: number | string | null;
  batteryPercent: number | string | null;
  /**
   * 누적 주행거리 (km). V24 부터 backend 가 응답에 포함; 텔레메트리 미수신이거나
   * 벤더 페이로드에서 값이 빠지면 null.
   */
  odometerKm: number | null;
  ignitionStatus: string;
  telemetrySource: string;
  drivingStatus: string;
  connectionStatus: string;
  batteryStatus: string;
  updatedAt: string;
};

export type FrontendBikeCurrentState = Omit<
  ServiceOpsBikeCurrentState,
  "latitude" | "longitude" | "speedKph" | "batteryPercent"
> & {
  latitude: number;
  longitude: number;
  speedKph: number | null;
  batteryPercent: number | null;
};

export type ServiceOpsBikeSnapshotBike = {
  id: string;
  idx: number | null;
  plateNumber: string;
  vin: string;
  modelName: string | null;
  operationStatus: ServiceOpsBikeOperationStatus;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceOpsBikeSnapshotActiveContract = {
  id: string;
  idx: number | null;
  contractTemplateId: string;
  templateName: string;
  templateCategory: string;
  templateReturnType: string | null;
  templateDurationUnit: string | null;
  templateDurationValue: number | null;
  templateIncludesInsurance: boolean;
  startAt: string;
  endAt: string | null;
  terminatedAt: string | null;
  terminatedReason: string | null;
  memo: string | null;
};

export type ServiceOpsBikeSnapshotRider = {
  id: string;
  idx: number | null;
  name: string;
  phoneNumber: string;
  teamName: string | null;
  areaName: string | null;
  appLinkStatus: string;
  memo: string | null;
  educationCompleted: boolean;
  latestEducationType: string | null;
  latestEducationCompletedAt: string | null;
  latestEducationExpiresAt: string | null;
  educationExpired: boolean;
};

export type ServiceOpsBikeSnapshotRiderInsurance = {
  id: string;
  insuranceItemId: string;
  itemName: string;
  category: string;
  coverageType: string | null;
  startsAt: string | null;
  endsAt: string | null;
  riderBikeContractId: string | null;
  memo: string | null;
};

export type ServiceOpsBikeSnapshotEquipment = {
  id: string;
  equipmentTypeId: string;
  typeName: string;
  equipmentLabel: string | null;
  modelName: string | null;
  serialNumber: string | null;
  installedAt: string;
  removedAt: string | null;
  managementDueDate: string | null;
  memo: string | null;
};

export type ServiceOpsBikeSnapshot = {
  bikeId: string;
  generatedAt: string;
  bike: ServiceOpsBikeSnapshotBike;
  activeContract: ServiceOpsBikeSnapshotActiveContract | null;
  rider: ServiceOpsBikeSnapshotRider | null;
  insurances: ServiceOpsBikeSnapshotRiderInsurance[];
  equipments: ServiceOpsBikeSnapshotEquipment[];
};

// ── Test-Matching types ──

export type ServiceOpsTestVehicle = {
  id: string;
  idx: number;
  plateNumber: string;
  bikeType: "TWO_WHEEL" | "FOUR_WHEEL";
  engineType: "ELECTRIC" | "ICE";
  imei: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceOpsTestRider = {
  id: string;
  idx: number;
  name: string;
  phoneNumber: string;
  trainingStatus: "ONLINE" | "OFFLINE" | "INCOMPLETE";
  teamName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceOpsTestMatching = {
  id: string;
  idx: number;
  testVehicleId: string;
  plateNumber: string;
  serviceType: "CALL_DELIVERY" | "DESIGNATED_DELIVERY" | "COLLECTION_CARE" | "BATCH_COLLECTION";
  testRiderId: string;
  riderName: string;
  phoneNumber: string;
  contractType: "SUBSCRIPTION" | "RENTAL";
  handoverType: "TAKEOVER" | "RETURN";
  startDate: string;  // "YYYY-MM-DD"
  endDate: string;    // "YYYY-MM-DD"
  validationStatus: "VALID" | "INVALID";
  validationMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type TestVehicleCreateInput = {
  plateNumber: string;
  bikeType: "TWO_WHEEL" | "FOUR_WHEEL";
  engineType: "ELECTRIC" | "ICE";
  imei?: string | null;
};

export type TestRiderCreateInput = {
  name: string;
  phoneNumber: string;
  trainingStatus: "ONLINE" | "OFFLINE" | "INCOMPLETE";
  teamName?: string | null;
};

export type TestMatchingCreateInput = {
  testVehicleId: string;
  serviceType: "CALL_DELIVERY" | "DESIGNATED_DELIVERY" | "COLLECTION_CARE" | "BATCH_COLLECTION";
  testRiderId: string;
  contractType: "SUBSCRIPTION" | "RENTAL";
  handoverType: "TAKEOVER" | "RETURN";
  startDate: string;  // "YYYY-MM-DD"
  endDate: string;    // "YYYY-MM-DD"
};

export type BulkRowStatus = 'UNCHANGED' | 'UPDATE' | 'NEW' | 'ERROR';

export interface BulkRowResult {
  rowNumber: number;
  status: BulkRowStatus;
  key: string;
  changes: string[];
  errorMessage: string | null;
}

export interface BulkPreviewResponse {
  rows: BulkRowResult[];
  summary: {
    unchanged: number;
    update: number;
    new: number;
    error: number;
    total: number;
  };
}

export interface BulkApplyResponse {
  applied: number;
  skipped: number;
}

export type ServiceOpsDispatchOrderStatus = "OFFERED" | "ASSIGNED" | "COMPLETED";
export type ServiceOpsDispatchOrderKind = "PICKUP" | "DELIVERY";
export type ServiceOpsDispatchRoundStatus = "COLLECTING" | "DELIVERING" | "DONE";
export type ServiceOpsDispatchRound = {
  batchId: string;
  status: ServiceOpsDispatchRoundStatus;
  pickupTotal: number;
  pickupDone: number;
  deliveryTotal: number;
  deliveryDone: number;
};

export type DeliveryCallPayload = {
  customerName: string;
  customerPhone: string;
  address: string;
  latitude: number;
  longitude: number;
};

/** 배차 주문 단건 — backend `DispatchOrderReadResponse` 와 1:1. lat/lng 는 JSON number. */
export type ServiceOpsDispatchOrder = {
  id: string;
  idx: number | null;
  bikeId: string | null;
  customerName: string;
  customerPhone: string;
  address: string;
  latitude: number;
  longitude: number;
  originAddress?: string | null;
  originLatitude?: number | null;
  originLongitude?: number | null;
  sequence: number;
  status: ServiceOpsDispatchOrderStatus;
  kind: ServiceOpsDispatchOrderKind;
  completedAt: string | null;
  /** 완료 처리한 관리자 이름. 구 버전 백엔드 호환 위해 optional. */
  completedBy?: string | null;
  /** 완료 사진이 첨부되어 있으면 true. 구 버전 백엔드 호환 위해 optional. */
  hasCompletionPhoto?: boolean;
  createdAt: string;
};

export type DispatchBulkPreviewRowStatus = "NEW" | "ERROR";

/** 배차 일괄 업로드 미리보기 행 — backend `DispatchBulkPreviewResponse.rows[]` 와 1:1. */
export type DispatchBulkPreviewRow = {
  rowNumber: number;
  plateNumber: string;
  bikeId: string | null;
  customerName: string;
  customerPhone: string;
  address: string;
  originAddress?: string | null;
  status: DispatchBulkPreviewRowStatus;
  message: string | null;
  sequence?: number | null;
};

export type DispatchBulkSummary = {
  total: number;
  new: number;
  error: number;
};

/** 배차 일괄 업로드 미리보기 응답 — backend `DispatchBulkPreviewResponse` 와 1:1. */
export type DispatchBulkPreviewResponse = {
  rows: DispatchBulkPreviewRow[];
  summary: DispatchBulkSummary;
};

/** bulk-apply 요청 행 — 지오코딩 완료된 좌표 포함. */
export type DispatchBulkApplyRow = {
  bikeId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  latitude: number;
  longitude: number;
  sequence?: number;
  originAddress?: string | null;
  originLatitude?: number | null;
  originLongitude?: number | null;
};

/** bulk-apply 요청 body — backend 가 `{ rows: [...] }` 로 받음. */
export type DispatchBulkApplyRequest = {
  rows: DispatchBulkApplyRow[];
};

// ── Re-ignition notification types ──

export type ServiceOpsReignitionNotification = {
  id: string;
  bikeId: string;
  plateNumber: string;
  occurredAt: string;
  nextCustomerName: string | null;
  nextAddress: string | null;
  nextLatitude: number | null;
  nextLongitude: number | null;
  createdAt: string;
};

export type ReignitionNotificationCreateInput = {
  bikeId: string;
  plateNumber: string;
  occurredAt: string;
  nextCustomerName?: string | null;
  nextAddress?: string | null;
  nextLatitude?: number | null;
  nextLongitude?: number | null;
};

// ── Generic notifications ──

export type ServiceOpsNotification = {
  id: string;
  idx?: number | null;
  type: string;
  title: string;
  body: string | null;
  refBikeId: string | null;
  refEntityId: string | null;
  refRiderId: string | null;
  occurredAt: string;
  acknowledgedAt: string | null;
  createdAt: string;
};

// ── Audit log ──

export type ServiceOpsAuditLog = {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  actor: string | null;
  occurredAt: string;
  createdAt: string;
};

export type AuditLogCreateInput = {
  entityType: string;
  entityId: string;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
};

export type ServiceOpsApiClient = {
  login: (request: { loginId: string; password: string }) => Promise<ServiceOpsAuthResponse>;
  refresh: (request: { refreshToken: string }) => Promise<ServiceOpsAuthResponse>;
  logout: () => Promise<void>;
  /** 로그인한 admin 본인 비밀번호 변경. 현재 비밀번호 매칭 실패 시 401. */
  changeAdminPassword: (request: { currentPassword: string; newPassword: string }) => Promise<void>;
  getDashboardMapState: () => Promise<FrontendDashboardMapState>;
  getBikeCurrentState: (bikeId: string) => Promise<FrontendBikeCurrentState>;
  getBikeSnapshot: (bikeId: string) => Promise<ServiceOpsBikeSnapshot>;
  getBikeNextCustomer: (bikeId: string) => Promise<ServiceOpsBikeNextCustomer | null>;
  setBikeNextCustomer: (bikeId: string, input: BikeNextCustomerUpsertInput) => Promise<ServiceOpsBikeNextCustomer>;
  clearBikeNextCustomer: (bikeId: string) => Promise<void>;
  promoteNextToCurrentBikeCustomer: (bikeId: string) => Promise<void>;
  getIntegrityReferenceChecks: () => Promise<ServiceOpsIntegrityScan>;
  listTips: (params?: { page?: number; size?: number }) => Promise<ServiceOpsPage<ServiceOpsTip>>;
  getTip: (id: string) => Promise<ServiceOpsTip>;
  createTip: (request: TipUpsertPayload) => Promise<ServiceOpsTip>;
  updateTip: (id: string, request: TipUpsertPayload) => Promise<ServiceOpsTip>;
  deleteTip: (id: string) => Promise<void>;
  listVehicles: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<FrontendVehicle>>;
  getVehicle: (id: string) => Promise<FrontendVehicle>;
  createVehicle: (request: VehicleCreateInput) => Promise<FrontendVehicle>;
  updateVehicle: (id: string, request: VehicleUpdateInput) => Promise<FrontendVehicle>;
  deleteVehicle: (id: string) => Promise<void>;
  changeVehicleOperationStatus: (id: string, request: VehicleOperationStatusChangeInput) => Promise<FrontendVehicle>;
  setVehicleIgnitionBlock: (id: string, request: BikeIgnitionBlockInput) => Promise<FrontendVehicle>;
  listVehicleOperationStatusHistories: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<ServiceOpsBikeOperationStatusHistory>>;
  getVehicleOperationStatusHistory: (id: string) => Promise<ServiceOpsBikeOperationStatusHistory>;
  listContractTemplates: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<ServiceOpsContractTemplate>>;
  getContractTemplate: (id: string) => Promise<ServiceOpsContractTemplate>;
  createContractTemplate: (request: ContractTemplateCreateInput) => Promise<ServiceOpsContractTemplate>;
  updateContractTemplate: (id: string, request: ContractTemplateUpdateInput) => Promise<ServiceOpsContractTemplate>;
  deleteContractTemplate: (id: string) => Promise<void>;
  listRiderBikeContracts: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<ServiceOpsRiderBikeContract>>;
  getRiderBikeContract: (id: string) => Promise<ServiceOpsRiderBikeContract>;
  createRiderBikeContract: (request: RiderBikeContractCreateInput) => Promise<ServiceOpsRiderBikeContract>;
  updateRiderBikeContract: (id: string, request: RiderBikeContractUpdateInput) => Promise<ServiceOpsRiderBikeContract>;
  terminateRiderBikeContract: (id: string, request: RiderBikeContractTerminateInput) => Promise<ServiceOpsRiderBikeContract>;
  listInsuranceItems: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<ServiceOpsInsuranceItem>>;
  getInsuranceItem: (id: string) => Promise<ServiceOpsInsuranceItem>;
  createInsuranceItem: (request: InsuranceItemCreateInput) => Promise<ServiceOpsInsuranceItem>;
  updateInsuranceItem: (id: string, request: InsuranceItemUpdateInput) => Promise<ServiceOpsInsuranceItem>;
  deleteInsuranceItem: (id: string) => Promise<void>;
  listRiderInsurances: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<ServiceOpsRiderInsurance>>;
  getRiderInsurance: (id: string) => Promise<ServiceOpsRiderInsurance>;
  createRiderInsurance: (request: RiderInsuranceCreateInput) => Promise<ServiceOpsRiderInsurance>;
  updateRiderInsurance: (id: string, request: RiderInsuranceUpdateInput) => Promise<ServiceOpsRiderInsurance>;
  deleteRiderInsurance: (id: string) => Promise<void>;
  listBatteryStations: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<FrontendBatteryStation>>;
  getBatteryStation: (id: string) => Promise<FrontendBatteryStation>;
  createBatteryStation: (request: BatteryStationCreateInput) => Promise<FrontendBatteryStation>;
  updateBatteryStation: (id: string, request: BatteryStationUpdateInput) => Promise<FrontendBatteryStation>;
  updateBatteryStationCounts: (id: string, request: BatteryStationCountUpdateInput) => Promise<FrontendBatteryStation>;
  deleteBatteryStation: (id: string) => Promise<void>;
  listStationBatteryCountLogs: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<ServiceOpsStationBatteryCountLog>>;
  getStationBatteryCountLog: (id: string) => Promise<ServiceOpsStationBatteryCountLog>;
  listEquipmentTypes: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<ServiceOpsEquipmentType>>;
  getEquipmentType: (id: string) => Promise<ServiceOpsEquipmentType>;
  createEquipmentType: (request: EquipmentTypeCreateInput) => Promise<ServiceOpsEquipmentType>;
  updateEquipmentType: (id: string, request: EquipmentTypeUpdateInput) => Promise<ServiceOpsEquipmentType>;
  deleteEquipmentType: (id: string) => Promise<void>;
  listBikeEquipments: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<ServiceOpsBikeEquipment>>;
  getBikeEquipment: (id: string) => Promise<ServiceOpsBikeEquipment>;
  createBikeEquipment: (request: BikeEquipmentCreateInput) => Promise<ServiceOpsBikeEquipment>;
  updateBikeEquipment: (id: string, request: BikeEquipmentUpdateInput) => Promise<ServiceOpsBikeEquipment>;
  removeBikeEquipment: (id: string, request: BikeEquipmentRemoveInput) => Promise<ServiceOpsBikeEquipment>;
  listDevices: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<ServiceOpsDevice>>;
  getDevice: (id: string) => Promise<ServiceOpsDevice>;
  createDevice: (request: DeviceCreateInput) => Promise<ServiceOpsDevice>;
  updateDevice: (id: string, request: DeviceUpdateInput) => Promise<ServiceOpsDevice>;
  deleteDevice: (id: string) => Promise<void>;
  listBikeDeviceInstallations: (params?: { page?: number; size?: number; sort?: string; bikeId?: string }) => Promise<ServiceOpsPage<ServiceOpsBikeDeviceInstallation>>;
  getBikeDeviceInstallation: (id: string) => Promise<ServiceOpsBikeDeviceInstallation>;
  createBikeDeviceInstallation: (request: BikeDeviceInstallationCreateInput) => Promise<ServiceOpsBikeDeviceInstallation>;
  removeBikeDeviceInstallation: (id: string, request: BikeDeviceInstallationRemoveInput) => Promise<ServiceOpsBikeDeviceInstallation>;
  /** 차량 단위 적용 가능 정비 항목 — backend 가 engineType + BOTH 매칭으로 필터링. */
  listMaintenanceItemsForBike: (bikeId: string) => Promise<ServiceOpsMaintenanceItem[]>;
  /** 전체 카탈로그 (페이지) — 차량 탭 정비 상태 필터가 모든 품목을 한 번에 받기 위해. */
  listMaintenanceItems: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<ServiceOpsMaintenanceItem>>;
  /** 한 차량의 정비 이벤트 로그 (최신순). */
  listMaintenanceRecordsForBike: (bikeId: string) => Promise<ServiceOpsVehicleMaintenanceRecord[]>;
  /** 전체 차량의 정비 이력 (페이지) — 차량 탭 정비 상태 필터 용. */
  listMaintenanceRecords: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<ServiceOpsVehicleMaintenanceRecord>>;
  /** "교환 완료" 마킹 — bike 별 정비 이력에 한 건 추가. */
  createMaintenanceRecord: (bikeId: string, request: MaintenanceRecordCreateInput) => Promise<ServiceOpsVehicleMaintenanceRecord>;
  /** 정비 카탈로그 편집 — 신규 품목 추가. */
  createMaintenanceItem: (request: MaintenanceItemCreateInput) => Promise<ServiceOpsMaintenanceItem>;
  /** 정비 카탈로그 편집 — 품목 partial update. */
  updateMaintenanceItem: (id: string, request: MaintenanceItemUpdateInput) => Promise<ServiceOpsMaintenanceItem>;
  /** 정비 카탈로그 편집 — soft delete. */
  deleteMaintenanceItem: (id: string) => Promise<void>;
  listRiders: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<FrontendRider>>;
  getRider: (id: string) => Promise<FrontendRider>;
  createRider: (request: RiderCreateInput) => Promise<FrontendRider>;
  updateRider: (id: string, request: RiderUpdateInput) => Promise<FrontendRider>;
  deleteRider: (id: string) => Promise<void>;
  listRiderEducationRecords: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<ServiceOpsRiderEducationRecord>>;
  listRiderEducationRecordsByRider: (
    riderId: string,
    params?: { page?: number; size?: number; sort?: string }
  ) => Promise<ServiceOpsPage<ServiceOpsRiderEducationRecord>>;
  getRiderEducationRecord: (id: string) => Promise<ServiceOpsRiderEducationRecord>;
  createRiderEducationRecord: (
    request: RiderEducationRecordCreateInput
  ) => Promise<ServiceOpsRiderEducationRecord>;
  updateRiderEducationRecord: (
    id: string,
    request: RiderEducationRecordUpdateInput
  ) => Promise<ServiceOpsRiderEducationRecord>;
  deleteRiderEducationRecord: (id: string) => Promise<void>;

  // ── Test-Matching ──
  listTestVehicles: () => Promise<ServiceOpsTestVehicle[]>;
  createTestVehicle: (input: TestVehicleCreateInput) => Promise<ServiceOpsTestVehicle>;
  deleteTestVehicle: (id: string) => Promise<void>;

  listTestRiders: () => Promise<ServiceOpsTestRider[]>;
  createTestRider: (input: TestRiderCreateInput) => Promise<ServiceOpsTestRider>;
  deleteTestRider: (id: string) => Promise<void>;

  listTestMatchings: () => Promise<ServiceOpsTestMatching[]>;
  createTestMatching: (input: TestMatchingCreateInput) => Promise<ServiceOpsTestMatching>;
  deleteTestMatching: (id: string) => Promise<void>;

  // ── Bulk import / export ──
  bulkPreviewVehicles: (file: File) => Promise<BulkPreviewResponse>;
  bulkApplyVehicles: (file: File) => Promise<BulkApplyResponse>;
  getVehiclesExportUrl: () => string;

  bulkPreviewRiders: (file: File) => Promise<BulkPreviewResponse>;
  bulkApplyRiders: (file: File) => Promise<BulkApplyResponse>;
  getRidersExportUrl: () => string;

  bulkPreviewMatching: (file: File) => Promise<BulkPreviewResponse>;
  bulkApplyMatching: (file: File) => Promise<BulkApplyResponse>;
  getMatchingExportUrl: () => string;

  // ── Dispatch orders (배차) ──
  listDispatchOrders: (bikeId: string) => Promise<ServiceOpsDispatchOrder[]>;
  listActiveDispatchOrders: () => Promise<ServiceOpsDispatchOrder[]>;
  completeDispatchOrder: (id: string, photo: File) => Promise<ServiceOpsDispatchOrder>;
  cancelDispatchOrder: (id: string) => Promise<void>;
  listCompletedDispatchOrders: (bikeId: string) => Promise<ServiceOpsDispatchOrder[]>;
  previewDispatchOrders: (file: File | FormData) => Promise<DispatchBulkPreviewResponse>;
  applyDispatchOrders: (rows: DispatchBulkApplyRow[]) => Promise<BulkApplyResponse>;
  previewSequentialDispatchOrders: (file: File | FormData) => Promise<DispatchBulkPreviewResponse>;
  applySequentialDispatchOrders: (rows: DispatchBulkApplyRow[]) => Promise<BulkApplyResponse>;
  getDispatchOrdersExportUrl: () => string;

  // ── Dispatch round (라운드) ──
  getActiveDispatchRound: () => Promise<ServiceOpsDispatchRound | null>;
  createDispatchRound: (rows: DispatchBulkApplyRow[]) => Promise<ServiceOpsDispatchRound>;
  startDispatchDelivery: (batchId: string) => Promise<ServiceOpsDispatchRound>;

  // ── 배민 단건 콜 (C1) ──
  systemDispatchCall: (payload: DeliveryCallPayload) => Promise<ServiceOpsDispatchOrder>;
  offerCall: (payload: DeliveryCallPayload) => Promise<ServiceOpsDispatchOrder>;
  acceptCall: (orderId: string, bikeId: string) => Promise<ServiceOpsDispatchOrder>;
  listOfferedCalls: () => Promise<ServiceOpsDispatchOrder[]>;

  // ── Re-ignition notifications ──
  recordReignitionNotification: (input: ReignitionNotificationCreateInput) => Promise<ServiceOpsReignitionNotification>;
  listReignitionNotifications: () => Promise<ServiceOpsReignitionNotification[]>;

  // ── Generic notifications ──
  listNotifications: (opts?: { unacknowledgedOnly?: boolean; type?: string }) => Promise<ServiceOpsNotification[]>;
  acknowledgeNotification: (id: string) => Promise<void>;

  // ── Audit logs ──
  recordAuditLog: (input: AuditLogCreateInput) => Promise<ServiceOpsAuditLog>;
  listAuditLogs: (entityId?: string) => Promise<ServiceOpsAuditLog[]>;
};

type ServiceOpsApiOptions = {
  accessToken?: string | null;
  baseUrl?: string | null;
  fetchImpl?: ServiceOpsFetch;
};

type ApiErrorBody = {
  code?: string;
  message?: string;
  path?: string;
  timestamp?: string;
  fieldViolations?: Array<{ field: string; message: string }>;
};

export class ServiceOpsApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ServiceOpsApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function normalizeServiceOpsBaseUrl(value?: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.includes("<") || trimmed.includes(">")) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function serviceOpsApiBaseUrl(): string | null {
  return normalizeServiceOpsBaseUrl(process.env.SERVICE_OPS_API_BASE_URL);
}

export function serviceOpsApiConfigured(baseUrl = process.env.SERVICE_OPS_API_BASE_URL): boolean {
  return normalizeServiceOpsBaseUrl(baseUrl) !== null;
}

export function createServiceOpsApiClient(options: ServiceOpsApiOptions = {}): ServiceOpsApiClient {
  const baseUrl = normalizeServiceOpsBaseUrl(options.baseUrl ?? process.env.SERVICE_OPS_API_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = options.accessToken;

  async function request<T>(
    path: string,
    init: RequestInit = {},
    query?: Record<string, string | number | undefined>
  ): Promise<T> {
    if (!baseUrl) {
      throw new ServiceOpsApiError("SERVICE_OPS_API_BASE_URL is not configured.", 0, "SERVICE_OPS_API_NOT_CONFIGURED");
    }

    const url = new URL(`${baseUrl}/api/v1${path}`);
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    if (accessToken && !headers.has("authorization")) {
      headers.set("authorization", `Bearer ${accessToken}`);
    }

    const response = await fetchImpl(url, {
      ...init,
      cache: "no-store",
      headers
    });
    const responseText = await response.text();
    const body = parseResponseBody(responseText);

    if (!response.ok) {
      const errorBody = isApiErrorBody(body) ? body : undefined;
      throw new ServiceOpsApiError(
        errorBody?.message ?? `Service ops API request failed with status ${response.status}.`,
        response.status,
        errorBody?.code,
        body
      );
    }

    return body as T;
  }

  return {
    login: (loginRequest) =>
      request<ServiceOpsAuthResponse>("/auth/login", {
        body: JSON.stringify(loginRequest),
        method: "POST"
      }),
    refresh: (refreshRequest) =>
      request<ServiceOpsAuthResponse>("/auth/refresh", {
        body: JSON.stringify(refreshRequest),
        method: "POST"
      }),
    logout: async () => {
      await request<void>("/auth/logout", { method: "POST" });
    },
    changeAdminPassword: async (passwordRequest) => {
      await request<void>("/auth/me/password", {
        body: JSON.stringify(passwordRequest),
        method: "PATCH"
      });
    },
    getDashboardMapState: async () =>
      toFrontendDashboardMapState(await request<ServiceOpsDashboardMapState>("/dashboard/map-state", { method: "GET" })),
    getBikeCurrentState: async (bikeId) =>
      toFrontendBikeCurrentState(
        await request<ServiceOpsBikeCurrentState>(
          `/telemetry/bikes/${encodeURIComponent(bikeId)}/current-state`,
          { method: "GET" }
        )
      ),
    getBikeSnapshot: async (bikeId) =>
      request<ServiceOpsBikeSnapshot>(
        `/dashboard/bikes/${encodeURIComponent(bikeId)}/snapshot`,
        { method: "GET" }
      ),
    getBikeNextCustomer: async (bikeId) => {
      try {
        return await request<ServiceOpsBikeNextCustomer>(
          `/bikes/${encodeURIComponent(bikeId)}/next-customer`,
          { method: "GET" }
        );
      } catch (e) {
        if (e instanceof ServiceOpsApiError && e.status === 404) return null;
        throw e;
      }
    },
    setBikeNextCustomer: (bikeId, input) =>
      request<ServiceOpsBikeNextCustomer>(
        `/bikes/${encodeURIComponent(bikeId)}/next-customer`,
        { body: JSON.stringify(input), method: "PUT" }
      ),
    clearBikeNextCustomer: (bikeId) =>
      request<void>(
        `/bikes/${encodeURIComponent(bikeId)}/next-customer`,
        { method: "DELETE" }
      ),
    promoteNextToCurrentBikeCustomer: async (bikeId) => {
      await request<void>(
        `/bikes/${encodeURIComponent(bikeId)}/next-customer/promote`,
        { method: "POST" }
      );
    },
    getIntegrityReferenceChecks: () =>
      request<ServiceOpsIntegrityScan>("/integrity/reference-checks", { method: "GET" }),
    listTips: ({ page = 0, size = 20 } = {}) =>
      request<ServiceOpsPage<ServiceOpsTip>>("/tips", { method: "GET" }, { page, size }),
    getTip: (id) =>
      request<ServiceOpsTip>(`/tips/${encodeURIComponent(id)}`, { method: "GET" }),
    createTip: (createRequest) =>
      request<ServiceOpsTip>("/tips", {
        body: JSON.stringify(createRequest),
        method: "POST"
      }),
    updateTip: (id, updateRequest) =>
      request<ServiceOpsTip>(`/tips/${encodeURIComponent(id)}`, {
        body: JSON.stringify(updateRequest),
        method: "PUT"
      }),
    deleteTip: async (id) => {
      await request<void>(`/tips/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    listVehicles: async ({ page = 0, size = 20, sort } = {}) => {
      const response = await request<ServiceOpsPage<ServiceOpsBike>>("/bikes", { method: "GET" }, { page, size, sort });
      return {
        ...response,
        items: response.items.map(toFrontendVehicle)
      };
    },
    getVehicle: async (id) => toFrontendVehicle(await request<ServiceOpsBike>(`/bikes/${encodeURIComponent(id)}`, { method: "GET" })),
    createVehicle: async (createRequest) =>
      toFrontendVehicle(
        await request<ServiceOpsBike>("/bikes", {
          body: JSON.stringify(createRequest),
          method: "POST"
        })
      ),
    updateVehicle: async (id, updateRequest) =>
      toFrontendVehicle(
        await request<ServiceOpsBike>(`/bikes/${encodeURIComponent(id)}`, {
          body: JSON.stringify(updateRequest),
          method: "PATCH"
        })
      ),
    deleteVehicle: async (id) => {
      await request<void>(`/bikes/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    changeVehicleOperationStatus: async (id, statusRequest) =>
      toFrontendVehicle(
        await request<ServiceOpsBike>(`/bikes/${encodeURIComponent(id)}/operation-status`, {
          body: JSON.stringify(statusRequest),
          method: "PATCH"
        })
      ),
    setVehicleIgnitionBlock: async (id, blockRequest) =>
      toFrontendVehicle(
        await request<ServiceOpsBike>(`/bikes/${encodeURIComponent(id)}/ignition-block`, {
          body: JSON.stringify(blockRequest),
          method: "PATCH"
        })
      ),
    listVehicleOperationStatusHistories: ({ page = 0, size = 20, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsBikeOperationStatusHistory>>(
        "/bike-operation-status-histories",
        { method: "GET" },
        { page, size, sort }
      ),
    getVehicleOperationStatusHistory: (id) =>
      request<ServiceOpsBikeOperationStatusHistory>(`/bike-operation-status-histories/${encodeURIComponent(id)}`, { method: "GET" }),
    listContractTemplates: ({ page = 0, size = 20, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsContractTemplate>>("/contract-templates", { method: "GET" }, { page, size, sort }),
    getContractTemplate: (id) =>
      request<ServiceOpsContractTemplate>(`/contract-templates/${encodeURIComponent(id)}`, { method: "GET" }),
    createContractTemplate: (createRequest) =>
      request<ServiceOpsContractTemplate>("/contract-templates", {
        body: JSON.stringify(createRequest),
        method: "POST"
      }),
    updateContractTemplate: (id, updateRequest) =>
      request<ServiceOpsContractTemplate>(`/contract-templates/${encodeURIComponent(id)}`, {
        body: JSON.stringify(updateRequest),
        method: "PATCH"
      }),
    deleteContractTemplate: async (id) => {
      await request<void>(`/contract-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    listRiderBikeContracts: ({ page = 0, size = 20, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsRiderBikeContract>>("/rider-bike-contracts", { method: "GET" }, { page, size, sort }),
    getRiderBikeContract: (id) =>
      request<ServiceOpsRiderBikeContract>(`/rider-bike-contracts/${encodeURIComponent(id)}`, { method: "GET" }),
    createRiderBikeContract: (createRequest) =>
      request<ServiceOpsRiderBikeContract>("/rider-bike-contracts", {
        body: JSON.stringify(createRequest),
        method: "POST"
      }),
    updateRiderBikeContract: (id, updateRequest) =>
      request<ServiceOpsRiderBikeContract>(`/rider-bike-contracts/${encodeURIComponent(id)}`, {
        body: JSON.stringify(updateRequest),
        method: "PATCH"
      }),
    terminateRiderBikeContract: (id, terminateRequest) =>
      request<ServiceOpsRiderBikeContract>(`/rider-bike-contracts/${encodeURIComponent(id)}/terminate`, {
        body: JSON.stringify(terminateRequest),
        method: "PATCH"
      }),
    listInsuranceItems: ({ page = 0, size = 20, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsInsuranceItem>>("/insurance-items", { method: "GET" }, { page, size, sort }),
    getInsuranceItem: (id) =>
      request<ServiceOpsInsuranceItem>(`/insurance-items/${encodeURIComponent(id)}`, { method: "GET" }),
    createInsuranceItem: (createRequest) =>
      request<ServiceOpsInsuranceItem>("/insurance-items", {
        body: JSON.stringify(createRequest),
        method: "POST"
      }),
    updateInsuranceItem: (id, updateRequest) =>
      request<ServiceOpsInsuranceItem>(`/insurance-items/${encodeURIComponent(id)}`, {
        body: JSON.stringify(updateRequest),
        method: "PATCH"
      }),
    deleteInsuranceItem: async (id) => {
      await request<void>(`/insurance-items/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    listRiderInsurances: ({ page = 0, size = 20, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsRiderInsurance>>("/rider-insurances", { method: "GET" }, { page, size, sort }),
    getRiderInsurance: (id) =>
      request<ServiceOpsRiderInsurance>(`/rider-insurances/${encodeURIComponent(id)}`, { method: "GET" }),
    createRiderInsurance: (createRequest) =>
      request<ServiceOpsRiderInsurance>("/rider-insurances", {
        body: JSON.stringify(createRequest),
        method: "POST"
      }),
    updateRiderInsurance: (id, updateRequest) =>
      request<ServiceOpsRiderInsurance>(`/rider-insurances/${encodeURIComponent(id)}`, {
        body: JSON.stringify(updateRequest),
        method: "PATCH"
      }),
    deleteRiderInsurance: async (id) => {
      await request<void>(`/rider-insurances/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    listBatteryStations: async ({ page = 0, size = 20, sort } = {}) => {
      const response = await request<ServiceOpsPage<ServiceOpsBatteryStation>>(
        "/battery-stations",
        { method: "GET" },
        { page, size, sort }
      );
      return {
        ...response,
        items: response.items.map(toFrontendBatteryStation)
      };
    },
    getBatteryStation: async (id) =>
      toFrontendBatteryStation(await request<ServiceOpsBatteryStation>(`/battery-stations/${encodeURIComponent(id)}`, { method: "GET" })),
    createBatteryStation: async (createRequest) =>
      toFrontendBatteryStation(
        await request<ServiceOpsBatteryStation>("/battery-stations", {
          body: JSON.stringify(createRequest),
          method: "POST"
        })
      ),
    updateBatteryStation: async (id, updateRequest) =>
      toFrontendBatteryStation(
        await request<ServiceOpsBatteryStation>(`/battery-stations/${encodeURIComponent(id)}`, {
          body: JSON.stringify(updateRequest),
          method: "PATCH"
        })
      ),
    updateBatteryStationCounts: async (id, countRequest) =>
      toFrontendBatteryStation(
        await request<ServiceOpsBatteryStation>(`/battery-stations/${encodeURIComponent(id)}/battery-counts`, {
          body: JSON.stringify(countRequest),
          method: "PATCH"
        })
      ),
    deleteBatteryStation: async (id) => {
      await request<void>(`/battery-stations/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    listStationBatteryCountLogs: ({ page = 0, size = 20, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsStationBatteryCountLog>>(
        "/station-battery-count-logs",
        { method: "GET" },
        { page, size, sort }
      ),
    getStationBatteryCountLog: (id) =>
      request<ServiceOpsStationBatteryCountLog>(`/station-battery-count-logs/${encodeURIComponent(id)}`, { method: "GET" }),
    listEquipmentTypes: ({ page = 0, size = 20, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsEquipmentType>>("/equipment-types", { method: "GET" }, { page, size, sort }),
    getEquipmentType: (id) =>
      request<ServiceOpsEquipmentType>(`/equipment-types/${encodeURIComponent(id)}`, { method: "GET" }),
    createEquipmentType: (createRequest) =>
      request<ServiceOpsEquipmentType>("/equipment-types", {
        body: JSON.stringify(createRequest),
        method: "POST"
      }),
    updateEquipmentType: (id, updateRequest) =>
      request<ServiceOpsEquipmentType>(`/equipment-types/${encodeURIComponent(id)}`, {
        body: JSON.stringify(updateRequest),
        method: "PATCH"
      }),
    deleteEquipmentType: async (id) => {
      await request<void>(`/equipment-types/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    listBikeEquipments: ({ page = 0, size = 20, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsBikeEquipment>>("/bike-equipments", { method: "GET" }, { page, size, sort }),
    getBikeEquipment: (id) =>
      request<ServiceOpsBikeEquipment>(`/bike-equipments/${encodeURIComponent(id)}`, { method: "GET" }),
    createBikeEquipment: (createRequest) =>
      request<ServiceOpsBikeEquipment>("/bike-equipments", {
        body: JSON.stringify(createRequest),
        method: "POST"
      }),
    updateBikeEquipment: (id, updateRequest) =>
      request<ServiceOpsBikeEquipment>(`/bike-equipments/${encodeURIComponent(id)}`, {
        body: JSON.stringify(updateRequest),
        method: "PATCH"
      }),
    removeBikeEquipment: (id, removeRequest) =>
      request<ServiceOpsBikeEquipment>(`/bike-equipments/${encodeURIComponent(id)}/remove`, {
        body: JSON.stringify(removeRequest),
        method: "PATCH"
      }),
    listDevices: ({ page = 0, size = 20, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsDevice>>("/devices", { method: "GET" }, { page, size, sort }),
    getDevice: (id) =>
      request<ServiceOpsDevice>(`/devices/${encodeURIComponent(id)}`, { method: "GET" }),
    createDevice: (createRequest) =>
      request<ServiceOpsDevice>("/devices", {
        body: JSON.stringify(createRequest),
        method: "POST"
      }),
    updateDevice: (id, updateRequest) =>
      request<ServiceOpsDevice>(`/devices/${encodeURIComponent(id)}`, {
        body: JSON.stringify(updateRequest),
        method: "PATCH"
      }),
    deleteDevice: async (id) => {
      await request<void>(`/devices/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    listBikeDeviceInstallations: ({ page = 0, size = 20, sort, bikeId } = {}) =>
      request<ServiceOpsPage<ServiceOpsBikeDeviceInstallation>>("/bike-device-installations", { method: "GET" }, { page, size, sort, bikeId }),
    getBikeDeviceInstallation: (id) =>
      request<ServiceOpsBikeDeviceInstallation>(`/bike-device-installations/${encodeURIComponent(id)}`, { method: "GET" }),
    createBikeDeviceInstallation: (createRequest) =>
      request<ServiceOpsBikeDeviceInstallation>("/bike-device-installations", {
        body: JSON.stringify(createRequest),
        method: "POST"
      }),
    removeBikeDeviceInstallation: (id, removeRequest) =>
      request<ServiceOpsBikeDeviceInstallation>(`/bike-device-installations/${encodeURIComponent(id)}/remove`, {
        body: JSON.stringify(removeRequest),
        method: "PATCH"
      }),
    // 정비 카탈로그 / 이력 — backend V22 슬라이스. 페이지 단위가 아니라 차량
    // 단위 list endpoint 라 그대로 array 응답.
    listMaintenanceItemsForBike: (bikeId) =>
      request<ServiceOpsMaintenanceItem[]>(
        `/bikes/${encodeURIComponent(bikeId)}/maintenance-items`,
        { method: "GET" }
      ),
    listMaintenanceItems: ({ page = 0, size = 200, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsMaintenanceItem>>(
        "/maintenance-items",
        { method: "GET" },
        { page, size, sort }
      ),
    listMaintenanceRecordsForBike: (bikeId) =>
      request<ServiceOpsVehicleMaintenanceRecord[]>(
        `/bikes/${encodeURIComponent(bikeId)}/maintenance-records`,
        { method: "GET" }
      ),
    listMaintenanceRecords: ({ page = 0, size = 500, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsVehicleMaintenanceRecord>>(
        "/maintenance-records",
        { method: "GET" },
        { page, size, sort }
      ),
    createMaintenanceRecord: (bikeId, createRequest) =>
      request<ServiceOpsVehicleMaintenanceRecord>(
        `/bikes/${encodeURIComponent(bikeId)}/maintenance-records`,
        { body: JSON.stringify(createRequest), method: "POST" }
      ),
    createMaintenanceItem: (createRequest) =>
      request<ServiceOpsMaintenanceItem>(
        "/maintenance-items",
        { body: JSON.stringify(createRequest), method: "POST" }
      ),
    updateMaintenanceItem: (id, updateRequest) =>
      request<ServiceOpsMaintenanceItem>(
        `/maintenance-items/${encodeURIComponent(id)}`,
        { body: JSON.stringify(updateRequest), method: "PATCH" }
      ),
    deleteMaintenanceItem: async (id) => {
      await request<void>(`/maintenance-items/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    listRiders: async ({ page = 0, size = 20, sort } = {}) => {
      const response = await request<ServiceOpsPage<ServiceOpsRider>>("/riders", { method: "GET" }, { page, size, sort });
      return {
        ...response,
        items: response.items.map(toFrontendRider)
      };
    },
    getRider: async (id) => toFrontendRider(await request<ServiceOpsRider>(`/riders/${encodeURIComponent(id)}`, { method: "GET" })),
    createRider: async (createRequest) =>
      toFrontendRider(
        await request<ServiceOpsRider>("/riders", {
          body: JSON.stringify(createRequest),
          method: "POST"
        })
      ),
    updateRider: async (id, updateRequest) =>
      toFrontendRider(
        await request<ServiceOpsRider>(`/riders/${encodeURIComponent(id)}`, {
          body: JSON.stringify(updateRequest),
          method: "PATCH"
        })
      ),
    deleteRider: async (id) => {
      await request<void>(`/riders/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    listRiderEducationRecords: ({ page = 0, size = 20, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsRiderEducationRecord>>(
        "/rider-education-records",
        { method: "GET" },
        { page, size, sort }
      ),
    listRiderEducationRecordsByRider: (riderId, { page = 0, size = 20, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsRiderEducationRecord>>(
        `/riders/${encodeURIComponent(riderId)}/education-records`,
        { method: "GET" },
        { page, size, sort }
      ),
    getRiderEducationRecord: (id) =>
      request<ServiceOpsRiderEducationRecord>(
        `/rider-education-records/${encodeURIComponent(id)}`,
        { method: "GET" }
      ),
    createRiderEducationRecord: (createRequest) =>
      request<ServiceOpsRiderEducationRecord>("/rider-education-records", {
        body: JSON.stringify(createRequest),
        method: "POST"
      }),
    updateRiderEducationRecord: (id, updateRequest) =>
      request<ServiceOpsRiderEducationRecord>(
        `/rider-education-records/${encodeURIComponent(id)}`,
        {
          body: JSON.stringify(updateRequest),
          method: "PATCH"
        }
      ),
    deleteRiderEducationRecord: async (id) => {
      await request<void>(`/rider-education-records/${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    // ── Test-Matching ──
    listTestVehicles: async () =>
      request<ServiceOpsTestVehicle[]>("/test-matching/vehicles", { method: "GET" }),

    createTestVehicle: async (input) =>
      request<ServiceOpsTestVehicle>("/test-matching/vehicles", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    deleteTestVehicle: async (id) => {
      await request<void>(`/test-matching/vehicles/${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    listTestRiders: async () =>
      request<ServiceOpsTestRider[]>("/test-matching/riders", { method: "GET" }),

    createTestRider: async (input) =>
      request<ServiceOpsTestRider>("/test-matching/riders", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    deleteTestRider: async (id) => {
      await request<void>(`/test-matching/riders/${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    listTestMatchings: async () =>
      request<ServiceOpsTestMatching[]>("/test-matching/matchings", { method: "GET" }),

    createTestMatching: async (input) =>
      request<ServiceOpsTestMatching>("/test-matching/matchings", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    deleteTestMatching: async (id) => {
      await request<void>(`/test-matching/matchings/${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    // ── Bulk import / export ──
    bulkPreviewVehicles: (file) => {
      const form = new FormData();
      form.append("file", file);
      return request<BulkPreviewResponse>("/bikes/bulk-preview", { method: "POST", body: form });
    },
    bulkApplyVehicles: (file) => {
      const form = new FormData();
      form.append("file", file);
      return request<BulkApplyResponse>("/bikes/bulk-apply", { method: "POST", body: form });
    },
    getVehiclesExportUrl: () => `${baseUrl}/api/v1/bikes/export`,

    bulkPreviewRiders: (file) => {
      const form = new FormData();
      form.append("file", file);
      return request<BulkPreviewResponse>("/riders/bulk-preview", { method: "POST", body: form });
    },
    bulkApplyRiders: (file) => {
      const form = new FormData();
      form.append("file", file);
      return request<BulkApplyResponse>("/riders/bulk-apply", { method: "POST", body: form });
    },
    getRidersExportUrl: () => `${baseUrl}/api/v1/riders/export`,

    bulkPreviewMatching: (file) => {
      const form = new FormData();
      form.append("file", file);
      return request<BulkPreviewResponse>("/contracts/bulk-preview", { method: "POST", body: form });
    },
    bulkApplyMatching: (file) => {
      const form = new FormData();
      form.append("file", file);
      return request<BulkApplyResponse>("/contracts/bulk-apply", { method: "POST", body: form });
    },
    getMatchingExportUrl: () => `${baseUrl}/api/v1/contracts/export`,

    // ── Dispatch orders (배차) ──
    listDispatchOrders: (bikeId) =>
      request<ServiceOpsDispatchOrder[]>("/dispatch-orders", { method: "GET" }, { bikeId }),
    listActiveDispatchOrders: () =>
      request<ServiceOpsDispatchOrder[]>("/dispatch-orders/active", { method: "GET" }),
    completeDispatchOrder: (id, photo) => {
      const form = new FormData();
      form.append("photo", photo);
      return request<ServiceOpsDispatchOrder>(
        `/dispatch-orders/${encodeURIComponent(id)}/complete`,
        { method: "POST", body: form }
      );
    },
    cancelDispatchOrder: async (id) => {
      await request<void>(`/dispatch-orders/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    listCompletedDispatchOrders: (bikeId) =>
      request<ServiceOpsDispatchOrder[]>(
        "/dispatch-orders/completed",
        { method: "GET" },
        { bikeId }
      ),
    previewDispatchOrders: (file) => {
      const form = file instanceof FormData ? file : new FormData();
      if (!(file instanceof FormData)) {
        form.append("file", file);
      }
      return request<DispatchBulkPreviewResponse>("/dispatch-orders/bulk-preview", { method: "POST", body: form });
    },
    applyDispatchOrders: (rows) =>
      request<BulkApplyResponse>("/dispatch-orders/bulk-apply", {
        body: JSON.stringify({ rows } satisfies DispatchBulkApplyRequest),
        method: "POST"
      }),
    previewSequentialDispatchOrders: (file) => {
      const form = file instanceof FormData ? file : new FormData();
      if (!(file instanceof FormData)) {
        form.append("file", file);
      }
      return request<DispatchBulkPreviewResponse>("/dispatch-orders/bulk-preview-sequential", { method: "POST", body: form });
    },
    applySequentialDispatchOrders: (rows) =>
      request<BulkApplyResponse>("/dispatch-orders/bulk-apply-sequential", {
        body: JSON.stringify({ rows } satisfies DispatchBulkApplyRequest),
        method: "POST"
      }),
    getDispatchOrdersExportUrl: () => `${baseUrl}/api/v1/dispatch-orders/export`,

    // ── Dispatch round (라운드) ──
    getActiveDispatchRound: async () => {
      if (!baseUrl) {
        throw new ServiceOpsApiError("SERVICE_OPS_API_BASE_URL is not configured.", 0, "SERVICE_OPS_API_NOT_CONFIGURED");
      }
      const url = new URL(`${baseUrl}/api/v1/dispatch-batches/active`);
      const headers = new Headers();
      if (accessToken) {
        headers.set("authorization", `Bearer ${accessToken}`);
      }
      const res = await fetchImpl(url, { method: "GET", cache: "no-store", headers });
      if (res.status === 204) return null;
      const responseText = await res.text();
      const body = parseResponseBody(responseText);
      if (!res.ok) {
        const errorBody = isApiErrorBody(body) ? body : undefined;
        throw new ServiceOpsApiError(
          errorBody?.message ?? `Service ops API request failed with status ${res.status}.`,
          res.status,
          errorBody?.code,
          body
        );
      }
      return body as ServiceOpsDispatchRound;
    },
    createDispatchRound: (rows) =>
      request<ServiceOpsDispatchRound>("/dispatch-batches/round", {
        body: JSON.stringify({ rows }),
        method: "POST"
      }),
    startDispatchDelivery: (batchId) =>
      request<ServiceOpsDispatchRound>(
        `/dispatch-batches/${encodeURIComponent(batchId)}/start-delivery`,
        { method: "POST" }
      ),

    // ── 배민 단건 콜 (C1) ──
    systemDispatchCall: (payload) =>
      request<ServiceOpsDispatchOrder>("/dispatch-orders/calls/system", {
        body: JSON.stringify(payload),
        method: "POST"
      }),
    offerCall: (payload) =>
      request<ServiceOpsDispatchOrder>("/dispatch-orders/calls/offer", {
        body: JSON.stringify(payload),
        method: "POST"
      }),
    acceptCall: (orderId, bikeId) =>
      request<ServiceOpsDispatchOrder>(`/dispatch-orders/calls/${encodeURIComponent(orderId)}/accept`, {
        body: JSON.stringify({ bikeId }),
        method: "POST"
      }),
    listOfferedCalls: () =>
      request<ServiceOpsDispatchOrder[]>("/dispatch-orders/calls/offered", { method: "GET" }),

    // ── Re-ignition notifications ──
    recordReignitionNotification: (input) =>
      request<ServiceOpsReignitionNotification>("/reignition-notifications", {
        body: JSON.stringify(input),
        method: "POST"
      }),
    listReignitionNotifications: () =>
      request<ServiceOpsReignitionNotification[]>("/reignition-notifications", { method: "GET" }),

    // ── Audit logs ──
    recordAuditLog: (input) =>
      request<ServiceOpsAuditLog>("/audit-logs", {
        body: JSON.stringify(input),
        method: "POST"
      }),
    listAuditLogs: (entityId) =>
      request<ServiceOpsAuditLog[]>(
        "/audit-logs",
        { method: "GET" },
        entityId !== undefined ? { entityId } : undefined
      ),

    // ── Generic notifications ──
    listNotifications: ({ unacknowledgedOnly, type } = {}) => {
      const query: Record<string, string | number | undefined> = {};
      if (unacknowledgedOnly !== undefined) query.unacknowledgedOnly = String(unacknowledgedOnly);
      if (type !== undefined) query.type = type;
      return request<ServiceOpsNotification[]>("/notifications", { method: "GET" }, query);
    },
    acknowledgeNotification: async (id) => {
      await request<void>(`/notifications/${encodeURIComponent(id)}/acknowledge`, { method: "POST" });
    },
  };
}

export function toFrontendBikeCurrentState(state: ServiceOpsBikeCurrentState): FrontendBikeCurrentState {
  return {
    ...state,
    latitude: toNumber(state.latitude),
    longitude: toNumber(state.longitude),
    speedKph: toNullableNumber(state.speedKph),
    batteryPercent: toNullableNumber(state.batteryPercent)
  };
}

export function toFrontendDashboardMapState(mapState: ServiceOpsDashboardMapState): FrontendDashboardMapState {
  return {
    generatedAt: mapState.generatedAt,
    summary: mapState.summary,
    bikePins: mapState.bikePins.map((pin) => ({
      ...pin,
      batteryPercent: toNullableNumber(pin.batteryPercent),
      latitude: toNumber(pin.latitude),
      longitude: toNumber(pin.longitude),
      slug: pin.bikeId,
      speedKph: toNullableNumber(pin.speedKph),
      nextCustomerLat: toNullableNumber(pin.nextCustomerLat),
      nextCustomerLng: toNullableNumber(pin.nextCustomerLng),
      // 배차 코어 — 구버전 백엔드는 필드를 안 보낼 수 있어 방어적 기본값.
      currentDispatchCustomerName: pin.currentDispatchCustomerName ?? null,
      currentDispatchAddress: pin.currentDispatchAddress ?? null,
      currentDispatchLatitude: toNullableNumber(pin.currentDispatchLatitude),
      currentDispatchLongitude: toNullableNumber(pin.currentDispatchLongitude),
      currentDispatchKind: pin.currentDispatchKind ?? null,
      dispatchQueueCount: pin.dispatchQueueCount ?? 0
    })),
    stationPins: mapState.stationPins.map((pin) => ({
      ...pin,
      latitude: toNumber(pin.latitude),
      longitude: toNumber(pin.longitude),
      slug: pin.stationId
    })),
    // 백엔드 tip 마이그레이션(Task 3-4) 전까지 응답에 `tips` 가 없을 수 있어
    // 방어적으로 읽는다. 도착하면 lat/lng 만 숫자로 정규화.
    tips: (((mapState as { tipPins?: unknown }).tipPins ?? []) as Array<{
      id: string;
      address: string;
      content: string;
      latitude: number | string;
      longitude: number | string;
    }>).map((tip) => ({
      id: tip.id,
      address: tip.address,
      content: tip.content,
      latitude: toNumber(tip.latitude),
      longitude: toNumber(tip.longitude)
    }))
  };
}

export function toFrontendVehicle(bike: ServiceOpsBike): FrontendVehicle {
  return {
    slug: bike.id,
    id: bike.id,
    idx: bike.idx,
    plateNumber: bike.plateNumber,
    vin: bike.vin,
    model: normalizeDisplayText(bike.modelName, "모델 미지정"),
    engineType: bike.engineType,
    serviceType: bike.serviceType,
    wheelType: bike.wheelType,
    imei: bike.imei,
    terminalId: bike.terminalId,
    status: toFrontendVehicleStatus(bike.operationStatus),
    operationStatus: bike.operationStatus,
    ignitionBlocked: bike.ignitionBlocked ?? false,
    assignmentStatus: "배정 API 후속",
    batteryPercent: null,
    locationLabel: "지도/텔레메트리 제외 범위",
    lastSeenAt: toDateOnly(bike.updatedAt),
    memo: bike.memo,
    createdAt: bike.createdAt,
    updatedAt: bike.updatedAt,
    source: "service-ops"
  };
}

export function toFrontendVehicleStatus(status: ServiceOpsBikeOperationStatus): FrontendVehicle["status"] {
  switch (status) {
    case "IN_SERVICE":
      return "운행";
    case "READY":
      return "대기";
  }

  throw new ServiceOpsApiError("Unsupported bike operation status returned by service ops API.", 0, "SERVICE_OPS_UNSUPPORTED_BIKE_STATUS", {
    operationStatus: status
  });
}

export function toFrontendRider(rider: ServiceOpsRider): FrontendRider {
  return {
    slug: rider.id,
    id: rider.id,
    idx: rider.idx,
    name: rider.name,
    phone: rider.phoneNumber,
    team: normalizeDisplayText(rider.teamName, "미지정"),
    area: normalizeDisplayText(rider.areaName, "미지정"),
    status: rider.appAccountLinked ? "활동" : "대기",
    joinedAt: toDateOnly(rider.createdAt),
    trainingStatus: rider.trainingStatus,
    appAccountLinked: rider.appAccountLinked,
    appAccountId: rider.appAccountId,
    appLinkedAt: rider.appLinkedAt,
    appLinkStatus: rider.appLinkStatus,
    memo: rider.memo,
    createdAt: rider.createdAt,
    updatedAt: rider.updatedAt,
    source: "service-ops"
  };
}

export function toFrontendBatteryStation(station: ServiceOpsBatteryStation): FrontendBatteryStation {
  const maxBatteryCapacity = station.maxBatteryCapacity;
  const currentBatteryCount = station.currentBatteryCount;
  const availableBatteryCount = station.availableBatteryCount;

  return {
    address: station.address,
    availableBatteryCount,
    availableBatteryLabel: station.availableBatteryLabel,
    batteryCount: currentBatteryCount,
    capacityPercentage: station.capacityPercentage,
    createdAt: station.createdAt,
    currentBatteryCount,
    id: station.id,
    idx: station.idx,
    latitude: toNumber(station.latitude),
    longitude: toNumber(station.longitude),
    maxBatteryCapacity,
    memo: station.memo,
    name: station.name,
    replaceableCount: availableBatteryCount,
    slug: station.id,
    source: "service-ops",
    stationStatus: station.status,
    status: toFrontendStationStatus(station.status),
    updatedAt: station.updatedAt
  };
}

export function toFrontendStationStatus(status: ServiceOpsStationStatus): FrontendBatteryStation["status"] {
  switch (status) {
    case "ACTIVE":
      return "운영 중";
    case "MAINTENANCE":
      return "점검 중";
    case "INACTIVE":
      return "운영 중지";
  }

  throw new ServiceOpsApiError("Unsupported battery station status returned by service ops API.", 0, "SERVICE_OPS_UNSUPPORTED_STATION_STATUS", {
    status
  });
}

export function toFrontendEquipmentType(type: ServiceOpsEquipmentType): EquipmentType {
  return {
    createdAt: type.createdAt,
    description: type.description,
    enabled: type.enabled,
    id: type.id,
    idx: type.idx,
    name: type.name,
    slug: type.id,
    source: "service-ops",
    updatedAt: type.updatedAt
  };
}

export function toFrontendDevice(device: ServiceOpsDevice): Device {
  return {
    createdAt: device.createdAt,
    deviceUid: device.deviceUid,
    enabled: device.enabled,
    id: device.id,
    idx: device.idx,
    manufacturer: device.manufacturer,
    memo: device.memo,
    modelName: device.modelName,
    slug: device.id,
    source: "service-ops",
    updatedAt: device.updatedAt
  };
}

function parseResponseBody(responseText: string): unknown {
  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && ("message" in value || "code" in value);
}

function normalizeDisplayText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return toNumber(value);
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
