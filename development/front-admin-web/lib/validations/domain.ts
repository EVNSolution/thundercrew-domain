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
  targetSelection: z.string().min(1, "라이더 또는 차량을 선택하세요."),
  provider: z.string().min(1, "보험사를 입력하세요."),
  policyNumber: z.string().min(1, "증권번호를 입력하세요."),
  startsAt: z.string().date(),
  endsAt: z.string().date(),
  status: z.enum(["정상", "만료 예정", "만료"])
});

export const stationSchema = z.object({
  name: z.string().min(2, "스테이션명을 입력하세요."),
  address: z.string().min(5, "주소를 입력하세요."),
  status: z.enum(["운영 중", "점검 중", "운영 중지"]),
  batteryCount: z.coerce.number().int().nonnegative(),
  replaceableCount: z.coerce.number().int().nonnegative()
});
