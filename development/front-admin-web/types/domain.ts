export type VehicleStatus = "운행 중" | "수리" | "점검 필요" | "대기";
export type AssignmentStatus = "배정됨" | "미배정" | "교대 예정";
export type ContractStatus = "활성" | "만료 예정" | "종료" | "초안";
export type InsuranceStatus = "정상" | "만료 예정" | "만료" | "비활성";
export type StationStatus = "운영 중" | "점검 중" | "운영 중지";
export type EquipmentManagementStatus = "정상" | "관리 예정" | "기한 초과" | "제거됨";
export type BikeDeviceInstallationStatus = "설치 중" | "제거됨";

export type Rider = {
  slug: string;
  name: string;
  phone: string;
  team: string;
  area: string;
  status: "활동" | "대기" | "휴면";
  joinedAt: string;
};

export type Vehicle = {
  slug: string;
  plateNumber: string;
  model: string;
  status: VehicleStatus;
  assignmentStatus: AssignmentStatus;
  id?: string;
  idx?: number | null;
  vin?: string | null;
  operationStatus?: "READY" | "IN_SERVICE" | "REPAIRING" | "INSPECTION_REQUIRED";
  batteryPercent: number | null;
  riderName?: string;
  locationLabel: string;
  lastSeenAt: string;
  memo?: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "mock" | "service-ops";
};


export type ContractTemplateCategory = "SUBSCRIPTION" | "RENTAL" | "CUSTOM";
export type ContractTemplateReturnType = "TAKEOVER" | "RETURN";
export type ContractTemplateDurationUnit =
  | "DAY"
  | "WEEK"
  | "MONTH"
  | "QUARTER"
  | "HALF_YEAR"
  | "YEAR";

export type ContractTemplate = {
  slug: string;
  id?: string;
  idx?: number | null;
  name: string;
  durationMinutes: number | null;
  unlimited: boolean;
  durationLabel: string;
  description?: string | null;
  enabled: boolean;
  systemTemplate: boolean;
  category?: ContractTemplateCategory;
  returnType?: ContractTemplateReturnType | null;
  durationUnit?: ContractTemplateDurationUnit | null;
  durationValue?: number | null;
  includesInsurance?: boolean;
  defaultInsuranceItemId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "mock" | "service-ops";
};

export type RiderContract = {
  slug: string;
  id?: string;
  idx?: number | null;
  riderName: string;
  riderId?: string;
  riderLabel?: string;
  bikeId?: string;
  bikeLabel?: string;
  contractTemplateId?: string;
  templateName?: string;
  contractType: string;
  startsAt: string;
  endsAt: string;
  status: ContractStatus;
  area: string;
  startAt?: string;
  endAt?: string | null;
  terminatedAt?: string | null;
  terminatedReason?: string | null;
  memo?: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "mock" | "service-ops";
};


export type InsuranceItem = {
  slug: string;
  id?: string;
  idx?: number | null;
  name: string;
  description?: string | null;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
  source?: "mock" | "service-ops";
};

export type InsurancePolicy = {
  slug: string;
  id?: string;
  idx?: number | null;
  holderLabel: string;
  targetType: "라이더" | "차량";
  provider: string;
  policyNumber: string;
  startsAt: string;
  endsAt: string;
  status: InsuranceStatus;
  riderId?: string;
  insuranceItemId?: string;
  memo?: string | null;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  source?: "mock" | "service-ops";
};

export type BatteryStation = {
  slug: string;
  id?: string;
  idx?: number | null;
  name: string;
  address: string;
  status: StationStatus;
  stationStatus?: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  maxBatteryCapacity?: number;
  currentBatteryCount?: number;
  availableBatteryCount?: number;
  availableBatteryLabel?: string;
  capacityPercentage?: number;
  batteryCount: number;
  replaceableCount: number;
  latitude: number;
  longitude: number;
  memo?: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "mock" | "service-ops";
};

export type EquipmentType = {
  slug: string;
  id?: string;
  idx?: number | null;
  name: string;
  description?: string | null;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
  source?: "mock" | "service-ops";
};

export type BikeEquipment = {
  slug: string;
  id?: string;
  idx?: number | null;
  bikeId?: string;
  bikeLabel: string;
  equipmentTypeId?: string;
  equipmentTypeName: string;
  equipmentLabel: string;
  modelName?: string | null;
  serialNumber?: string | null;
  installedAt: string;
  removedAt?: string | null;
  managementDueDate: string;
  managementStatus: EquipmentManagementStatus;
  managementStatusCode?: "NORMAL" | "DUE_SOON" | "OVERDUE";
  managementNote?: string | null;
  memo?: string | null;
  source?: "mock" | "service-ops";
};

export type Device = {
  slug: string;
  id?: string;
  idx?: number | null;
  deviceUid: string;
  manufacturer?: string | null;
  modelName?: string | null;
  enabled: boolean;
  memo?: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "mock" | "service-ops";
};

export type BikeDeviceInstallation = {
  slug: string;
  id?: string;
  idx?: number | null;
  bikeId?: string;
  bikeLabel: string;
  deviceId?: string;
  deviceLabel: string;
  deviceUid?: string;
  installedAt: string;
  removedAt?: string | null;
  status: BikeDeviceInstallationStatus;
  memo?: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "mock" | "service-ops";
};
