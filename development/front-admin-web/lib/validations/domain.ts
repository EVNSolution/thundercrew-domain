import { z } from "zod";

export const vehicleSchema = z.object({
  plateNumber: z.string().min(2, "차량번호를 입력하세요."),
  model: z.string().min(2, "모델명을 입력하세요."),
  status: z.enum(["운행 중", "수리", "점검 필요", "대기"]),
  assignmentTarget: z.string().optional(),
  stationOrLocation: z.string().min(2, "위치 기준을 입력하세요.")
});

export const riderSchema = z.object({
  name: z.string().min(2, "이름을 입력하세요."),
  phone: z.string().min(9, "연락처를 입력하세요."),
  team: z.string().min(1, "소속을 선택하세요."),
  area: z.string().min(1, "담당 구역을 선택하세요."),
  status: z.enum(["활동", "대기", "휴면"])
});

export const contractSchema = z.object({
  riderSelection: z.string().min(1, "라이더를 선택하세요."),
  bikeSelection: z.string().min(1, "차량을 선택하세요."),
  contractTemplateSelection: z.string().min(1, "계약 양식을 선택하세요."),
  startAt: z.string().min(1, "계약 시작일시를 선택하세요."),
  memo: z.string().optional()
});

export const insuranceSchema = z.object({
  riderSelection: z.string().min(1, "라이더를 선택하세요."),
  insuranceItemSelection: z.string().min(1, "보험 항목을 선택하세요."),
  enabled: z.enum(["true", "false"]),
  memo: z.string().optional()
});

export const stationSchema = z.object({
  name: z.string().min(2, "스테이션명을 입력하세요."),
  address: z.string().min(5, "주소를 입력하세요."),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]),
  maxBatteryCapacity: z.coerce.number().int().nonnegative(),
  currentBatteryCount: z.coerce.number().int().nonnegative(),
  availableBatteryCount: z.coerce.number().int().nonnegative(),
  memo: z.string().optional()
}).refine((value) => value.maxBatteryCapacity >= value.currentBatteryCount, {
  message: "최대 보관 수량은 현재 보유 수량보다 작을 수 없습니다.",
  path: ["maxBatteryCapacity"]
}).refine((value) => value.currentBatteryCount >= value.availableBatteryCount, {
  message: "현재 보유 수량은 교체 가능 수량보다 작을 수 없습니다.",
  path: ["availableBatteryCount"]
});

export const equipmentTypeSchema = z.object({
  name: z.string().min(1, "장비 종류명을 입력하세요.").max(100),
  description: z.string().optional(),
  enabled: z.enum(["true", "false"])
});

export const bikeEquipmentSchema = z.object({
  bikeSelection: z.string().min(1, "차량을 선택하세요."),
  equipmentTypeSelection: z.string().min(1, "장비 종류를 선택하세요."),
  equipmentLabel: z.string().max(100).optional(),
  modelName: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  installedAt: z.string().min(1, "설치일시를 선택하세요."),
  managementDueDate: z.string().min(1, "관리 기한을 선택하세요."),
  managementNote: z.string().optional(),
  memo: z.string().optional()
});
