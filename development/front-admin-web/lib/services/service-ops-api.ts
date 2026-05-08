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

export type ServiceOpsBikeOperationStatus = "READY" | "IN_SERVICE" | "REPAIRING" | "INSPECTION_REQUIRED";

export type ServiceOpsBike = {
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

export type FrontendVehicle = {
  slug: string;
  id?: string;
  idx?: number | null;
  plateNumber: string;
  vin?: string | null;
  model: string;
  status: "운행 중" | "수리" | "점검 필요" | "대기";
  operationStatus?: ServiceOpsBikeOperationStatus;
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
  vin: string;
  modelName?: string | null;
  operationStatus: ServiceOpsBikeOperationStatus;
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

export type FrontendDashboardBikePin = Omit<ServiceOpsDashboardBikePin, "latitude" | "longitude" | "speedKph" | "batteryPercent"> & {
  slug: string;
  latitude: number;
  longitude: number;
  speedKph: number | null;
  batteryPercent: number | null;
};

export type FrontendDashboardStationPin = Omit<ServiceOpsDashboardStationPin, "latitude" | "longitude"> & {
  slug: string;
  latitude: number;
  longitude: number;
};

export type FrontendDashboardMapState = {
  generatedAt: string;
  summary: ServiceOpsDashboardSummary;
  bikePins: FrontendDashboardBikePin[];
  stationPins: FrontendDashboardStationPin[];
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

export type ServiceOpsApiClient = {
  login: (request: { loginId: string; password: string }) => Promise<ServiceOpsAuthResponse>;
  refresh: (request: { refreshToken: string }) => Promise<ServiceOpsAuthResponse>;
  logout: () => Promise<void>;
  getDashboardMapState: () => Promise<FrontendDashboardMapState>;
  getBikeCurrentState: (bikeId: string) => Promise<FrontendBikeCurrentState>;
  getBikeSnapshot: (bikeId: string) => Promise<ServiceOpsBikeSnapshot>;
  getIntegrityReferenceChecks: () => Promise<ServiceOpsIntegrityScan>;
  listVehicles: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<FrontendVehicle>>;
  getVehicle: (id: string) => Promise<FrontendVehicle>;
  createVehicle: (request: VehicleCreateInput) => Promise<FrontendVehicle>;
  updateVehicle: (id: string, request: VehicleUpdateInput) => Promise<FrontendVehicle>;
  deleteVehicle: (id: string) => Promise<void>;
  changeVehicleOperationStatus: (id: string, request: VehicleOperationStatusChangeInput) => Promise<FrontendVehicle>;
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
  listBikeDeviceInstallations: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<ServiceOpsBikeDeviceInstallation>>;
  getBikeDeviceInstallation: (id: string) => Promise<ServiceOpsBikeDeviceInstallation>;
  createBikeDeviceInstallation: (request: BikeDeviceInstallationCreateInput) => Promise<ServiceOpsBikeDeviceInstallation>;
  removeBikeDeviceInstallation: (id: string, request: BikeDeviceInstallationRemoveInput) => Promise<ServiceOpsBikeDeviceInstallation>;
  listRiders: (params?: { page?: number; size?: number; sort?: string }) => Promise<ServiceOpsPage<FrontendRider>>;
  getRider: (id: string) => Promise<FrontendRider>;
  createRider: (request: RiderCreateInput) => Promise<FrontendRider>;
  updateRider: (id: string, request: RiderUpdateInput) => Promise<FrontendRider>;
  deleteRider: (id: string) => Promise<void>;
  listRiderEducationRecordsByRider: (
    riderId: string,
    params?: { page?: number; size?: number; sort?: string }
  ) => Promise<ServiceOpsPage<ServiceOpsRiderEducationRecord>>;
  createRiderEducationRecord: (
    request: RiderEducationRecordCreateInput
  ) => Promise<ServiceOpsRiderEducationRecord>;
  deleteRiderEducationRecord: (id: string) => Promise<void>;
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
    if (init.body && !headers.has("content-type")) {
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
    getIntegrityReferenceChecks: () =>
      request<ServiceOpsIntegrityScan>("/integrity/reference-checks", { method: "GET" }),
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
    listBikeDeviceInstallations: ({ page = 0, size = 20, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsBikeDeviceInstallation>>("/bike-device-installations", { method: "GET" }, { page, size, sort }),
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
    listRiderEducationRecordsByRider: (riderId, { page = 0, size = 20, sort } = {}) =>
      request<ServiceOpsPage<ServiceOpsRiderEducationRecord>>(
        `/riders/${encodeURIComponent(riderId)}/education-records`,
        { method: "GET" },
        { page, size, sort }
      ),
    createRiderEducationRecord: (createRequest) =>
      request<ServiceOpsRiderEducationRecord>("/rider-education-records", {
        body: JSON.stringify(createRequest),
        method: "POST"
      }),
    deleteRiderEducationRecord: async (id) => {
      await request<void>(`/rider-education-records/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
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
      speedKph: toNullableNumber(pin.speedKph)
    })),
    stationPins: mapState.stationPins.map((pin) => ({
      ...pin,
      latitude: toNumber(pin.latitude),
      longitude: toNumber(pin.longitude),
      slug: pin.stationId
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
    status: toFrontendVehicleStatus(bike.operationStatus),
    operationStatus: bike.operationStatus,
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
      return "운행 중";
    case "REPAIRING":
      return "수리";
    case "INSPECTION_REQUIRED":
      return "점검 필요";
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
