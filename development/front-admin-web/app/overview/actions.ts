"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type ServiceOpsBikeOperationStatus,
  type ServiceOpsStationStatus,
  type ServiceOpsRiderEducationType,
  serviceOpsApiConfigured
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import { geocodeAddress } from "@/lib/services/ncp-geocoder";

/**
 * /overview tab create actions. Each posts a single backend create call,
 * revalidates /overview, and redirects back to the originating tab so the
 * dialog unmounts and the table picks up the new row. Mock mode (no
 * service-ops backend) silent-redirects so the dialog UX stays preview-
 * able without a real connection.
 */

export async function createRiderFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=riders");
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
    redirect("/overview?tab=riders&status=create-error");
  }

  // Optional 교육 여부 sidecar: when the operator picked ONLINE / OFFLINE
  // we stamp a fresh rider_education_record with completedAt = now so
  // the /overview riders tab's 교육 여부 column lights up immediately.
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

  revalidatePath("/overview");
  redirect("/overview?tab=riders");
}

export async function deleteRiderFromOverviewAction(riderId: string): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=riders");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteRider(riderId);
  } catch {
    redirect("/overview?tab=riders&status=delete-error");
  }

  revalidatePath("/overview");
  redirect("/overview?tab=riders");
}

export async function createVehicleFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=vehicles");
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
      operationStatus: String(formData.get("operationStatus") ?? "READY") as ServiceOpsBikeOperationStatus
    });
  } catch {
    redirect("/overview?tab=vehicles&status=create-error");
  }

  revalidatePath("/overview");
  redirect("/overview?tab=vehicles");
}

export async function deleteVehicleFromOverviewAction(vehicleId: string): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=vehicles");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteVehicle(vehicleId);
  } catch {
    redirect("/overview?tab=vehicles&status=delete-error");
  }

  revalidatePath("/overview");
  redirect("/overview?tab=vehicles");
}

export async function deleteStationFromOverviewAction(stationId: string): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=stations");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteBatteryStation(stationId);
  } catch {
    redirect("/overview?tab=stations&status=delete-error");
  }

  revalidatePath("/overview");
  redirect("/overview?tab=stations");
}

export async function updateRiderFromOverviewAction(
  riderId: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=riders");
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
    redirect("/overview?tab=riders&status=update-error");
  }

  revalidatePath("/overview");
  redirect("/overview?tab=riders");
}

export async function updateVehicleFromOverviewAction(
  vehicleId: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=vehicles");
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
    // 차체 기본 정보 (plateNumber / modelName) 는 일반 update endpoint 로,
    // operationStatus 는 상태 이력을 남기는 별도 endpoint 로 분리 호출. 둘
    // 다 같은 트랜잭션은 아니지만 운영자 입장에선 한 번의 "저장" 으로 묶이게 한다.
    await client.updateVehicle(vehicleId, {
      plateNumber: requiredText(formData.get("plateNumber")),
      modelName: optionalText(formData.get("modelName"))
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
    redirect("/overview?tab=vehicles&status=update-error");
  }

  revalidatePath("/overview");
  redirect("/overview?tab=vehicles");
}

export async function updateStationFromOverviewAction(
  stationId: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=stations");
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
    // /overview 에서 station 의 식별 키는 주소다 (name 도 동일하게 동기화).
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
    redirect("/overview?tab=stations&status=update-error");
  }

  revalidatePath("/overview");
  redirect("/overview?tab=stations");
}

export async function createContractFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview");
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
    redirect("/overview?status=contract-create-error");
  }

  revalidatePath("/overview");
  redirect("/overview");
}

export async function setVehicleIgnitionBlockFromOverviewAction(
  vehicleId: string,
  formData: FormData
): Promise<void> {
  // 라이더 상세 다이얼로그의 "시동 방지" 토글 폼이 호출. hidden field `blocked`
  // 가 "true"/"false" 문자열을 담아 보내고, 우리는 그걸 boolean 으로 normalize.
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=riders");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const nextBlocked = String(formData.get("blocked") ?? "").toLowerCase() === "true";

  try {
    await client.setVehicleIgnitionBlock(vehicleId, { blocked: nextBlocked });
  } catch {
    redirect("/overview?tab=riders&status=ignition-block-error");
  }

  revalidatePath("/overview");
  redirect("/overview?tab=riders");
}

export async function terminateContractFromOverviewAction(contractId: string): Promise<void> {
  // 종료 버튼은 라이더 상세 다이얼로그에서만 호출되므로, redirect 도 항상
  // 라이더 탭으로 돌아간다. `/overview` 만 주면 default = vehicles 로
  // 넘어가서 운영자가 작업 컨텍스트를 잃는 문제가 있었음.
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=riders");
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
    redirect("/overview?tab=riders&status=contract-terminate-error");
  }

  revalidatePath("/overview");
  redirect("/overview?tab=riders");
}

export async function createInsuranceFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview");
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
    redirect("/overview?status=insurance-create-error");
  }

  revalidatePath("/overview");
  redirect("/overview");
}

export async function deleteInsuranceFromOverviewAction(insuranceId: string): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview");
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  try {
    await client.deleteRiderInsurance(insuranceId);
  } catch {
    redirect("/overview?status=insurance-delete-error");
  }

  revalidatePath("/overview");
  redirect("/overview");
}

export async function createStationFromOverviewAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/overview?tab=stations");
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
    redirect("/overview?tab=stations&status=create-error");
  }

  revalidatePath("/overview");
  redirect("/overview?tab=stations");
}

function requiredText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = requiredText(value);
  return text ? text : null;
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
