export type VehicleStatus = "운행 중" | "수리" | "점검 필요" | "대기";
export type AssignmentStatus = "배정됨" | "미배정" | "교대 예정";
export type ContractStatus = "활성" | "만료 예정" | "종료" | "초안";
export type InsuranceStatus = "정상" | "만료 예정" | "만료";
export type StationStatus = "운영 중" | "점검 중" | "운영 중지";

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

export type InsurancePolicy = {
  slug: string;
  holderLabel: string;
  targetType: "라이더" | "차량";
  provider: string;
  policyNumber: string;
  startsAt: string;
  endsAt: string;
  status: InsuranceStatus;
};

export type BatteryStation = {
  slug: string;
  name: string;
  address: string;
  status: StationStatus;
  batteryCount: number;
  replaceableCount: number;
  latitude: number;
  longitude: number;
};
