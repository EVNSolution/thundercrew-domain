"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type ServiceOpsBikeEngineType,
  type ServiceOpsBikeOperationStatus,
  type ServiceOpsStationStatus,
  type ServiceOpsRiderEducationType,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import { geocodeAddress } from "@/lib/services/ncp-geocoder";

/**
 * 루트 페이지(`/`) 의 차량 / 라이더 / BSS 탭이 호출하는 server actions.
 * 각 액션은 단일 backend create / update / delete 호출 후 `/` 를
 * revalidate 하고 원래 탭으로 redirect 해 다이얼로그가 닫히고 표가 새 행을
 * 집어 들도록 한다. Mock 모드(service-ops backend 미설정) 에선 silent-
 * redirect 만 해서 다이얼로그 UX 가 실제 연결 없이도 미리보기 가능.
 *
 * 함수 이름의 `*FromOverviewAction` 접미사는 옛 `/overview` 라우트 시절
 * 작명을 그대로 유지 — 컴포넌트 import 가 많아 일괄 rename 의 churn 이
 * 크기 때문. 의미상 "운영 콘솔 루트에서 호출되는 액션" 으로 읽으면 된다.
 */

export async function createRiderFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=riders");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  let riderId: string;
  try {
    const rider = await client.createRider({
      name: requiredText(formData.get("name")),
      phoneNumber: requiredText(formData.get("phoneNumber"))
    });
    riderId = rider.id ?? rider.slug;
  } catch {
    redirect("/?tab=riders&status=create-error");
  }

  // Optional 교육 여부 sidecar: when the operator picked ONLINE / OFFLINE
  // we stamp a fresh rider_education_record with completedAt = now so
  // the root riders tab's 교육 여부 column lights up immediately.
  const educationTypeRaw = String(formData.get("initialEducationType") ?? "").trim();
  if (educationTypeRaw === "ONLINE" || educationTypeRaw === "OFFLINE") {
    try {
      await client.createRiderEducationRecord({
        riderId,
        educationType: educationTypeRaw as ServiceOpsRiderEducationType,
        completedAt: new Date().toISOString(),
        courseName: null,
        expiresAt: null,
        certificateNo: null,
        issuingAuthority: null,
        evidenceUrl: null,
        memo: null
      });
    } catch {
      // Fail-soft - the rider exists; operator can register the education
      // record from the (future) detail flow later.
    }
  }

  revalidatePath("/");
  redirect("/?tab=riders");
}

export async function deleteRiderFromOverviewAction(riderId: string): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=riders");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteRider(riderId);
  } catch {
    redirect("/?tab=riders&status=delete-error");
  }

  revalidatePath("/");
  redirect("/?tab=riders");
}

export async function createVehicleFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=vehicles");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.createVehicle({
      plateNumber: requiredText(formData.get("plateNumber")),
      // VIN is optional at register time (see BikeCreateRequest). Operator
      // updates the row later via the (future) edit flow once the VIN
      // sticker has been read off the vehicle.
      vin: null,
      modelName: optionalText(formData.get("modelName")),
      engineType: parseEngineType(formData.get("engineType")),
      operationStatus: String(formData.get("operationStatus") ?? "READY") as ServiceOpsBikeOperationStatus
    });
  } catch {
    redirect("/?tab=vehicles&status=create-error");
  }

  revalidatePath("/");
  redirect("/?tab=vehicles");
}

export async function deleteVehicleFromOverviewAction(vehicleId: string): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=vehicles");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteVehicle(vehicleId);
  } catch {
    redirect("/?tab=vehicles&status=delete-error");
  }

  revalidatePath("/");
  redirect("/?tab=vehicles");
}

export async function deleteStationFromOverviewAction(stationId: string): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=stations");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteBatteryStation(stationId);
  } catch {
    redirect("/?tab=stations&status=delete-error");
  }

  revalidatePath("/");
  redirect("/?tab=stations");
}

export async function updateRiderFromOverviewAction(
  riderId: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=riders");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  // 라이더 다이얼로그의 보험 select 가 hidden field 로 같이 보낸 현재 가입
  // 상태. 새 선택값과 비교해 (삭제 / 신규 / 교체) 셋 중 하나를 분기 실행.
  const nextInsuranceItemId = requiredText(formData.get("insuranceItemId"));
  const currentInsuranceId = requiredText(formData.get("currentInsuranceId"));
  const currentInsuranceItemId = requiredText(formData.get("currentInsuranceItemId"));

  try {
    await client.updateRider(riderId, {
      name: requiredText(formData.get("name")),
      phoneNumber: requiredText(formData.get("phoneNumber"))
    });
    if (nextInsuranceItemId !== currentInsuranceItemId) {
      // 옛 가입이 있으면 먼저 제거. 백엔드는 active 한 rider_insurance 행이
      // 라이더당 하나라는 가정을 강하게 잡고 있어서 새로 만들기 전에 비워줌.
      if (currentInsuranceId) {
        await client.deleteRiderInsurance(currentInsuranceId);
      }
      // "없음" 선택이 아니면 새 가입을 만든다.
      if (nextInsuranceItemId) {
        await client.createRiderInsurance({
          riderId,
          insuranceItemId: nextInsuranceItemId,
          enabled: true
        });
      }
    }
  } catch {
    redirect("/?tab=riders&status=update-error");
  }

  revalidatePath("/");
  redirect("/?tab=riders");
}

export async function updateVehicleFromOverviewAction(
  vehicleId: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=vehicles");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const nextStatus = String(formData.get("operationStatus") ?? "") as ServiceOpsBikeOperationStatus;
  const currentStatus = String(formData.get("currentOperationStatus") ?? "") as ServiceOpsBikeOperationStatus;
  // 단말기(IMEI) 변경 의도는 세 가지 값으로 표현:
  //   - 새 IMEI 값 (string) → set / change
  //   - 빈 문자열 + currentInstallationId 가 있음 → 기존 부착 해제
  //   - 빈 문자열 + currentInstallationId 도 없음 → no-op
  const nextDeviceUid = String(formData.get("deviceUid") ?? "").trim();
  const currentInstallationId = String(formData.get("currentInstallationId") ?? "").trim();
  const currentDeviceUid = String(formData.get("currentDeviceUid") ?? "").trim();

  try {
    // 차체 기본 정보 (plateNumber / modelName / engineType) 는 일반 update
    // endpoint 로, operationStatus 는 상태 이력을 남기는 별도 endpoint 로
    // 분리 호출. 둘 다 같은 트랜잭션은 아니지만 운영자 입장에선 한 번의
    // "저장" 으로 묶이게 한다.
    await client.updateVehicle(vehicleId, {
      plateNumber: requiredText(formData.get("plateNumber")),
      modelName: optionalText(formData.get("modelName")),
      engineType: parseEngineType(formData.get("engineType"))
    });
    if (nextStatus && nextStatus !== currentStatus) {
      await client.changeVehicleOperationStatus(vehicleId, {
        operationStatus: nextStatus,
        reason: "OPERATOR_EDIT"
      });
    }
    // IMEI 변경 처리는 위 두 호출이 성공한 다음에만 진행. 운영자가 IMEI 만
    // 바꾸려고 같은 plateNumber 를 다시 저장해도 멱등 — backend 가 동일 값
    // update 는 no-op 처리한다.
    if (nextDeviceUid !== currentDeviceUid) {
      if (!nextDeviceUid) {
        // 비움 → 기존 installation 해제
        if (currentInstallationId) {
          await client.removeBikeDeviceInstallation(currentInstallationId, {
            removedAt: new Date().toISOString(),
            memo: "운영자 차량 상세에서 IMEI 해제"
          });
        }
      } else {
        // 새 IMEI → 기존 device 가 있으면 재사용, 없으면 생성 후 부착.
        // backend 는 새 installation 생성 시 같은 bike 의 이전 active row 를
        // 자동으로 close 하므로 별도로 detach 호출할 필요 없음.
        let deviceId: string | null = null;
        const devicePage = await client.listDevices({ page: 0, size: 200 });
        const existing = devicePage.items.find((row) => row.deviceUid === nextDeviceUid);
        if (existing) {
          deviceId = existing.id;
        } else {
          const created = await client.createDevice({ deviceUid: nextDeviceUid, enabled: true });
          deviceId = created.id;
        }
        await client.createBikeDeviceInstallation({
          bikeId: vehicleId,
          deviceId,
          installedAt: new Date().toISOString(),
          memo: "운영자 차량 상세에서 IMEI 부착"
        });
      }
    }
  } catch {
    redirect("/?tab=vehicles&status=update-error");
  }

  revalidatePath("/");
  redirect("/?tab=vehicles");
}

export async function updateStationFromOverviewAction(
  stationId: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=stations");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const address = requiredText(formData.get("address"));
  const maxBatteryCapacity = parseNumber(formData.get("maxBatteryCapacity"), 0);
  const availableBatteryCount = parseNumber(formData.get("availableBatteryCount"), 0);
  const currentMax = parseNumber(formData.get("currentMaxBatteryCapacity"), maxBatteryCapacity);
  const currentAvailable = parseNumber(formData.get("currentAvailableBatteryCount"), availableBatteryCount);

  // 주소가 바뀌었으면 좌표도 같이 갱신해줘야 지도 마커가 새 위치로 이동한다.
  // env 미설정 / geocode 실패 시엔 좌표를 안 보내고 기존 값을 유지한다
  // (undefined 면 백엔드가 해당 필드를 안 건드림).
  const geocoded = await geocodeAddress(address);

  try {
    // 루트 페이지에서 station 의 식별 키는 주소다 (name 도 동일하게 동기화).
    // 주소만 바뀌어도 둘 다 같이 갱신해야 한다.
    await client.updateBatteryStation(stationId, {
      name: address,
      address,
      latitude: geocoded?.latitude ?? undefined,
      longitude: geocoded?.longitude ?? undefined
    });
    if (maxBatteryCapacity !== currentMax || availableBatteryCount !== currentAvailable) {
      await client.updateBatteryStationCounts(stationId, {
        maxBatteryCapacity,
        currentBatteryCount: availableBatteryCount,
        availableBatteryCount,
        reason: "OPERATOR_EDIT"
      });
    }
  } catch {
    redirect("/?tab=stations&status=update-error");
  }

  revalidatePath("/");
  redirect("/?tab=stations");
}

export async function createContractFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.createRiderBikeContract({
      riderId: requiredText(formData.get("riderId")),
      bikeId: requiredText(formData.get("bikeId")),
      contractTemplateId: requiredText(formData.get("contractTemplateId")),
      // <input type="date" value="2026-05-14"> 같은 값을 ISO instant 로 끌어올린다.
      // 시작 시각이 따로 안 들어오면 그 날짜의 00:00 KST 기준으로 시작.
      startAt: parseIsoDate(formData.get("startAt"))
    });
  } catch {
    redirect("/?status=contract-create-error");
  }

  revalidatePath("/");
  redirect("/");
}

export async function setVehicleOperationStatusFromOverviewAction(
  vehicleId: string,
  formData: FormData
): Promise<void> {
  // 차량 탭 행의 "운영 상태" 인라인 토글이 호출. hidden field `operationStatus`
  // 가 "IN_SERVICE" / "READY" 둘 중 하나. 별도 detail 다이얼로그 저장 흐름은
  // 그대로 두되, 한 컬럼 즉시 변경용으로 가벼운 endpoint 하나 분리.
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=vehicles");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const next = String(formData.get("operationStatus") ?? "") as ServiceOpsBikeOperationStatus;
  if (next !== "IN_SERVICE" && next !== "READY") {
    redirect("/?tab=vehicles&status=operation-status-error");
  }

  try {
    await client.changeVehicleOperationStatus(vehicleId, {
      operationStatus: next,
      reason: "OPERATOR_EDIT"
    });
  } catch {
    redirect("/?tab=vehicles&status=operation-status-error");
  }

  revalidatePath("/");
  redirect("/?tab=vehicles");
}

// ============================================================================
// 정비 카탈로그 편집 — "정비" 탭에서 운영자가 default cycle / 품목 / 그룹을
// 추가/수정/삭제. backend V22 의 maintenance-items endpoint 를 그대로 호출.
// ============================================================================

import type { ServiceOpsMaintenanceAppliesTo } from "@/lib/services/service-ops-api";

export async function createMaintenanceItemAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=maintenance");
  }
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const name = requiredText(formData.get("name"));
  if (!name) {
    redirect("/?tab=maintenance&status=maintenance-item-missing-name");
  }
  const appliesTo = parseAppliesTo(formData.get("appliesTo"));
  if (!appliesTo) {
    redirect("/?tab=maintenance&status=maintenance-item-invalid-applies-to");
  }
  const cycleKm = optionalInteger(formData.get("cycleKm"));
  const cycleMonths = optionalInteger(formData.get("cycleMonths"));
  const cycleLabel = optionalText(formData.get("cycleLabel"));
  if (cycleKm === null && cycleMonths === null && !cycleLabel) {
    // 백엔드 check 제약과 동일 정책 — 최소 한 종류의 cycle 표현은 있어야 한다.
    redirect("/?tab=maintenance&status=maintenance-item-cycle-required");
  }
  const parentItemId = optionalText(formData.get("parentItemId"));
  const displayOrder = optionalInteger(formData.get("displayOrder"));
  try {
    await client.createMaintenanceItem({
      name,
      appliesTo,
      parentItemId,
      cycleKm,
      cycleMonths,
      cycleLabel,
      displayOrder: displayOrder ?? null,
      memo: optionalText(formData.get("memo"))
    });
  } catch {
    redirect("/?tab=maintenance&status=maintenance-item-create-error");
  }
  revalidatePath("/");
  redirect("/?tab=maintenance");
}

export async function updateMaintenanceItemAction(
  itemId: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=maintenance");
  }
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }
  const name = optionalText(formData.get("name"));
  const appliesTo = parseAppliesTo(formData.get("appliesTo"));
  // 모든 필드 optional; cycle 들은 명시적 null (빈 입력) 도 그대로 반영.
  try {
    await client.updateMaintenanceItem(itemId, {
      name,
      appliesTo: appliesTo ?? null,
      parentItemId: optionalText(formData.get("parentItemId")),
      cycleKm: optionalInteger(formData.get("cycleKm")),
      cycleMonths: optionalInteger(formData.get("cycleMonths")),
      cycleLabel: optionalText(formData.get("cycleLabel")),
      displayOrder: optionalInteger(formData.get("displayOrder")),
      enabled: parseOptionalBoolean(formData.get("enabled")),
      memo: optionalText(formData.get("memo"))
    });
  } catch {
    redirect("/?tab=maintenance&status=maintenance-item-update-error");
  }
  revalidatePath("/");
  redirect("/?tab=maintenance");
}

export async function deleteMaintenanceItemAction(itemId: string): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=maintenance");
  }
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }
  try {
    await client.deleteMaintenanceItem(itemId);
  } catch {
    redirect("/?tab=maintenance&status=maintenance-item-delete-error");
  }
  revalidatePath("/");
  redirect("/?tab=maintenance");
}

function parseAppliesTo(value: FormDataEntryValue | null): ServiceOpsMaintenanceAppliesTo | null {
  const text = String(value ?? "").trim();
  if (text === "ELECTRIC" || text === "ICE" || text === "BOTH") return text;
  return null;
}

function parseOptionalBoolean(value: FormDataEntryValue | null): boolean | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "true") return true;
  if (text === "false") return false;
  return null;
}

function optionalInteger(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export type MarkVehicleMaintenanceServicedResult =
  | { ok: true }
  | { ok: false; reason: "not-configured" | "session-required" | "missing-item" | "record-error" };

export async function markVehicleMaintenanceServicedAction(
  vehicleId: string,
  formData: FormData
): Promise<MarkVehicleMaintenanceServicedResult> {
  // 차량 floating panel 의 "교환 완료" 버튼이 호출. 같은 차량 + 같은 품목에
  // 대해 row 를 한 건 새로 추가하기만 한다 — 다음 교환 예정 / 임박 / 지연
  // 등은 derived 라 클라이언트가 list 재조회로 갱신.
  //
  // **Return semantics**: redirect 를 던지지 않고 결과를 객체로 돌려준다. 호출자
  // (`MaintenanceRowView`) 가 await 으로 완료를 감지한 직후 panel 안의 정비
  // bundle 을 재페치해 새 record 가 즉시 반영되도록 하기 위함. 페이지의 다른
  // 영역 (차량 표의 정비 요약 배지 등) 은 `revalidatePath("/")` 로 갱신.
  if (!serviceOpsApiConfigured()) {
    return { ok: false, reason: "not-configured" };
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    return { ok: false, reason: "session-required" };
  }

  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) {
    return { ok: false, reason: "missing-item" };
  }
  const odoRaw = String(formData.get("servicedAtOdometerKm") ?? "").trim();
  const odo = odoRaw ? Number.parseInt(odoRaw, 10) : null;

  try {
    await client.createMaintenanceRecord(vehicleId, {
      itemId,
      servicedAt: null,
      servicedAtOdometerKm: odo !== null && Number.isFinite(odo) ? odo : null,
      memo: null
    });
  } catch {
    return { ok: false, reason: "record-error" };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function setVehicleIgnitionBlockFromOverviewAction(
  vehicleId: string,
  formData: FormData
): Promise<void> {
  // 라이더 상세 다이얼로그의 "시동 방지" 토글 폼이 호출. hidden field `blocked`
  // 가 "true"/"false" 문자열을 담아 보내고, 우리는 그걸 boolean 으로 normalize.
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=riders");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const nextBlocked = String(formData.get("blocked") ?? "").toLowerCase() === "true";

  try {
    await client.setVehicleIgnitionBlock(vehicleId, { blocked: nextBlocked });
  } catch {
    redirect("/?tab=riders&status=ignition-block-error");
  }

  revalidatePath("/");
  redirect("/?tab=riders");
}

export async function terminateContractFromOverviewAction(contractId: string): Promise<void> {
  // 종료 버튼은 라이더 상세 다이얼로그에서만 호출되므로, redirect 도 항상
  // 라이더 탭으로 돌아간다. `/` 만 주면 default = vehicles 로
  // 넘어가서 운영자가 작업 컨텍스트를 잃는 문제가 있었음.
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=riders");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.terminateRiderBikeContract(contractId, {
      terminatedAt: new Date().toISOString(),
      terminatedReason: "OPERATOR_TERMINATE"
    });
  } catch {
    redirect("/?tab=riders&status=contract-terminate-error");
  }

  revalidatePath("/");
  redirect("/?tab=riders");
}

export async function createInsuranceFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.createRiderInsurance({
      riderId: requiredText(formData.get("riderId")),
      insuranceItemId: requiredText(formData.get("insuranceItemId")),
      enabled: true
    });
  } catch {
    redirect("/?status=insurance-create-error");
  }

  revalidatePath("/");
  redirect("/");
}

export async function deleteInsuranceFromOverviewAction(insuranceId: string): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteRiderInsurance(insuranceId);
  } catch {
    redirect("/?status=insurance-delete-error");
  }

  revalidatePath("/");
  redirect("/");
}

export async function createStationFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/?tab=stations");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  // Dialog only collects the three fields the operator wants to fill on
  // register (address + 총·잔여 수량); the rest of BatteryStationCreate
  // Input is filled with sensible defaults that the operator can correct
  // later via the backend's update endpoint.
  const address = requiredText(formData.get("address"));
  const maxBatteryCapacity = parseNumber(formData.get("maxBatteryCapacity"), 0);
  const availableBatteryCount = parseNumber(formData.get("availableBatteryCount"), 0);

  // 다음/카카오 우편번호 팝업은 좌표를 안 돌려주므로 NCP geocoding 으로
  // 주소 → 위경도 변환을 따로 한다. NCP env 미설정이거나 응답 실패면
  // null 이라 (0, 0) 폴백 — 등록 자체는 막지 않고, 운영자가 나중에 직접
  // 좌표를 손볼 수 있도록 한다. 지도엔 안 떠도 row 는 존재하는 상태.
  const geocoded = await geocodeAddress(address);

  try {
    await client.createBatteryStation({
      name: address, // operator identifies station by address; can be edited later.
      address,
      latitude: geocoded?.latitude ?? 0,
      longitude: geocoded?.longitude ?? 0,
      status: "ACTIVE" as ServiceOpsStationStatus,
      maxBatteryCapacity,
      currentBatteryCount: availableBatteryCount,
      availableBatteryCount
    });
  } catch {
    redirect("/?tab=stations&status=create-error");
  }

  revalidatePath("/");
  redirect("/?tab=stations");
}

function requiredText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = requiredText(value);
  return text ? text : null;
}

// formData("engineType") 가 빈 값이면 undefined 로 (backend 가 ELECTRIC default
// 처리). 인식 못 하는 값은 잡고 무시 — 운영자 UI 의 select 만 접근하는 경로라
// 사실상 ELECTRIC / ICE 둘 중 하나만 들어오지만, 외부에서 잘못된 값이 들어와도
// throw 하지 않고 그냥 backend default 에 위임.
function parseEngineType(value: FormDataEntryValue | null): ServiceOpsBikeEngineType | undefined {
  const text = String(value ?? "").trim();
  if (text === "ELECTRIC" || text === "ICE") return text;
  return undefined;
}

function parseNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

// <input type="date"> 는 "YYYY-MM-DD" 문자열을 준다. 백엔드 startAt 은 ISO
// instant (UTC) 기대.
//
// 핵심: "오늘" 을 골랐을 때는 KST 자정이 아니라 **현재 시각** 으로 박는다.
// 이유는 백엔드 overlap 검사가 옛 계약의 terminated_at 까지의 점유 구간을
// 본다 — newStartAt 을 오늘 자정으로 두면, 오늘 오전에 종료된 옛 계약과
// [오늘 자정, terminated_at) 구간에서 겹치는 것으로 판단되어 거부된다.
// 운영자 멘탈 모델 ("지금부터 새 매칭") 과 어긋나는 거짓 양성.
//
// 미래 날짜를 골랐을 때는 그 날짜 KST 자정으로 두는 게 자연스럽다 (예약).
// 과거 날짜는 굳이 backdate 할 이유가 거의 없어서 그냥 "지금" 으로 폴백.
function parseIsoDate(value: FormDataEntryValue | null): string {
  const text = String(value ?? "").trim();
  if (!text) return new Date().toISOString();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.valueOf()) ? new Date().toISOString() : parsed.toISOString();
  }
  const [, y, m, d] = match;
  const kstMidnight = new Date(`${y}-${m}-${d}T00:00:00+09:00`);
  if (Number.isNaN(kstMidnight.valueOf())) return new Date().toISOString();
  const nowMs = Date.now();
  // 미래 자정만 그대로 사용; 그 외(오늘/과거) 는 현재 시각으로 정규화.
  return kstMidnight.valueOf() > nowMs ? kstMidnight.toISOString() : new Date(nowMs).toISOString();
}
