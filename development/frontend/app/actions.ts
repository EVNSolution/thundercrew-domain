"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  type ServiceOpsBikeEngineType,
  type ServiceOpsBikePurpose,
  type ServiceOpsRiderRole,
  type ServiceOpsRiderSkillLevel,
  type ServiceOpsBikeOperationStatus,
  type ServiceOpsBikeNextCustomer,
  type BikeNextCustomerUpsertInput,
  type ServiceOpsRiderEducationType,
  type AuditLogCreateInput,
  type ServiceOpsNotification,
  serviceOpsApiConfigured,
  ServiceOpsApiError
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

export async function updateRiderFromOverviewAction(
  riderId: string,
  returnTo: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(returnTo);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  // 등급 select 의 "NONE" 은 미판정으로 되돌리기 — clearSkillLevel 플래그로
  // 표현한다 (JSON null 은 "무변경" 과 구분이 안 되므로, backend V58 참고).
  const skillRaw = String(formData.get("skillLevel") ?? "").trim();
  try {
    await client.updateRider(riderId, {
      name: requiredText(formData.get("name")),
      phoneNumber: requiredText(formData.get("phoneNumber")),
      role: parseRiderRole(formData.get("role")),
      // 빈 칸은 "" 로 보낸다 — backend 가 blank 를 "팀 없음"(null) 으로
      // 정규화한다. optionalText 면 null=무변경이라 비우기가 불가능하다.
      teamName: requiredText(formData.get("teamName")),
      skillLevel: parseSkillLevel(formData.get("skillLevel")),
      ...(skillRaw === "NONE" ? { clearSkillLevel: true } : {})
    });
  } catch {
    redirect(withStatus(returnTo, "update-error"));
  }

  revalidatePath("/");
  redirect(returnTo);
}

export async function updateVehicleFromOverviewAction(
  vehicleId: string,
  returnTo: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect(returnTo);
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const nextStatus = String(formData.get("operationStatus") ?? "") as ServiceOpsBikeOperationStatus;
  const currentStatus = String(formData.get("currentOperationStatus") ?? "") as ServiceOpsBikeOperationStatus;
  const engineType = parseEngineType(formData.get("engineType"));
  const purpose = parsePurpose(formData.get("purpose"));
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
      engineType,
      purpose,
      // 상세 폼은 IMEI / 단말기 ID 입력을 항상 렌더하므로 빈 칸 = "지우기" 의도.
      // optionalText 면 빈 칸이 null 로 가서 backend 의 "null=변경 안 함" 분기에
      // 걸려 기존 값이 안 지워진다. requiredText 로 빈 문자열("")을 보내 backend
      // 의 isBlank()→null 경로(=clear)를 타게 한다.
      imei: requiredText(formData.get("imei")),
      terminalId: requiredText(formData.get("terminalId"))
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
    // 시뮬레이션 device 감지: uid 가 "-1" 이거나 "-1-" 으로 시작하는 경우.
    const currentIsSimDevice = currentDeviceUid === "-1" || currentDeviceUid.startsWith("-1-");
    const nextIsSimDevice = nextDeviceUid === "-1";
    // 운영자가 이미 시뮬레이션 device 인 차량에 "-1" 을 다시 입력해 저장하면 no-op.
    // (currentDeviceUid="-1-abc" / nextDeviceUid="-1" 처럼 문자열이 달라도 동일 의미.)
    if (!(currentIsSimDevice && nextIsSimDevice) && nextDeviceUid !== currentDeviceUid) {
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
        //
        // 예외: deviceUid="-1" (가상 시뮬레이션 단말기) 는 여러 차량이 같은
        // device 를 공유하면 backend 가 이전 차량의 installation 을 닫아버려
        // 한 번에 한 대만 시뮬레이션되는 문제가 생긴다. 따라서 "-1" 은
        // vehicleId 를 포함한 고유 uid 로 차량별 독립 device 를 생성한다.
        // (백엔드 deviceUid unique 제약을 피하면서도 "-1-" 접두사로 시뮬레이션 감지 유지.)
        let deviceId: string | null = null;
        if (nextDeviceUid === "-1") {
          // 가상 시뮬레이션 단말기 — 차량마다 독립 device 생성 (공유 금지).
          // deviceUid 에 vehicleId prefix 를 붙여 백엔드 unique 제약 회피.
          // 감지 로직은 "-1" 또는 "-1-" 으로 시작하는 uid 를 모두 시뮬레이션으로 인식.
          const simUid = `-1-${vehicleId.replace(/-/g, "").slice(0, 8)}`;
          const created = await client.createDevice({ deviceUid: simUid, enabled: true });
          deviceId = created.id;
        } else {
          const devicePage = await client.listDevices({ page: 0, size: 200 });
          const existing = devicePage.items.find((row) => row.deviceUid === nextDeviceUid);
          if (existing) {
            deviceId = existing.id;
          } else {
            const created = await client.createDevice({ deviceUid: nextDeviceUid, enabled: true });
            deviceId = created.id;
          }
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
    redirect(withStatus(returnTo, "update-error"));
  }

  revalidatePath("/");
  redirect(returnTo);
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

import type { ServiceOpsMaintenanceCategory } from "@/lib/services/service-ops-api";

const MAINTENANCE_WHEELS = ["TWO_WHEEL", "FOUR_WHEEL"] as const;
const MAINTENANCE_ENGINES = ["ELECTRIC", "ICE", "LPG"] as const;

// 분류는 휠(2륜/4륜) × 엔진(전기/내연) 두 축의 교차곱으로 만든다.
// 와일드카드 없음 — 선택된 휠·엔진만 교차한다. 한 축이라도 비면 결과는 빈
// 배열(클라이언트가 제출 자체를 막고, create 액션은 빈 배열을 거른다).
function categoriesFromAxes(
  wheelValues: FormDataEntryValue[],
  engineValues: FormDataEntryValue[]
): ServiceOpsMaintenanceCategory[] {
  const wheelSet = new Set(wheelValues.map((v) => String(v)));
  const engineSet = new Set(engineValues.map((v) => String(v)));
  const wheels = MAINTENANCE_WHEELS.filter((w) => wheelSet.has(w));
  const engines = MAINTENANCE_ENGINES.filter((e) => engineSet.has(e));
  const out: ServiceOpsMaintenanceCategory[] = [];
  for (const w of wheels) {
    for (const e of engines) {
      out.push(`${w}_${e}` as ServiceOpsMaintenanceCategory);
    }
  }
  return out;
}

export async function createMaintenanceItemAction(formData: FormData): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/management/maintenance");
  }
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const name = requiredText(formData.get("name"));
  if (!name) {
    redirect("/management/maintenance?status=maintenance-item-missing-name");
  }
  const categories = categoriesFromAxes(formData.getAll("wheels"), formData.getAll("engines"));
  if (categories.length === 0) {
    redirect("/management/maintenance?status=maintenance-item-invalid-applies-to");
  }
  const cycleKm = optionalInteger(formData.get("cycleKm"));
  const cycleMonths = optionalInteger(formData.get("cycleMonths"));
  if (cycleKm === null && cycleMonths === null) {
    // 백엔드 check 제약과 동일 정책 — 최소 한 종류의 cycle 표현은 있어야 한다.
    redirect("/management/maintenance?status=maintenance-item-cycle-required");
  }
  const alertThresholdPercent = optionalInteger(formData.get("alertThresholdPercent"));
  try {
    await client.createMaintenanceItem({
      name,
      categories,
      cycleKm,
      cycleMonths,
      alertThresholdPercent
    });
  } catch {
    redirect("/management/maintenance?status=maintenance-item-create-error");
  }
  revalidatePath("/management/maintenance");
  redirect("/management/maintenance");
}

export async function updateMaintenanceItemAction(
  itemId: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/management/maintenance");
  }
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }
  const name = optionalText(formData.get("name"));
  const categories = categoriesFromAxes(formData.getAll("wheels"), formData.getAll("engines"));
  // 주기 축은 or 입력(한 축만 제출) — 그 한 축마저 비우면 DB check
  // (cycle 최소 1종) 위반으로 조용히 실패하므로 create 와 같은 검증을 건다.
  if (
    optionalInteger(formData.get("cycleKm")) === null &&
    optionalInteger(formData.get("cycleMonths")) === null
  ) {
    redirect("/management/maintenance?status=maintenance-item-cycle-required");
  }
  try {
    await client.updateMaintenanceItem(itemId, {
      name,
      categories,
      cycleKm: optionalInteger(formData.get("cycleKm")),
      cycleMonths: optionalInteger(formData.get("cycleMonths")),
      alertThresholdPercent: optionalInteger(formData.get("alertThresholdPercent"))
    });
  } catch {
    redirect("/management/maintenance?status=maintenance-item-update-error");
  }
  revalidatePath("/management/maintenance");
  redirect("/management/maintenance");
}

export async function deleteMaintenanceItemAction(itemId: string): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    redirect("/management/maintenance");
  }
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }
  try {
    await client.deleteMaintenanceItem(itemId);
  } catch {
    redirect("/management/maintenance?status=maintenance-item-delete-error");
  }
  revalidatePath("/management/maintenance");
  redirect("/management/maintenance");
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

/**
 * 대시보드 지도의 `BikeDetailPanel` 에서 호출하는 시동 방지 토글 액션.
 * `/monitoring` 페이지가 삭제되면서 이 파일로 이관됨.
 * 성공 시 redirect 없이 revalidate 만 수행 — 폴링 다음 tick 에 새
 * ignitionBlocked 값이 반영되고, optimistic state 가 그 사이를 메워준다.
 * `revalidatePath("/")` 는 의도적 — BikeDetailPanel 이 루트 경로(`/`)에
 * 렌더링되기 때문이다 (삭제된 `/monitoring` 이 아님).
 */
export async function setVehicleIgnitionBlockFromDashboardAction(
  vehicleId: string,
  formData: FormData
): Promise<void> {
  if (!serviceOpsApiConfigured()) {
    return;
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) {
    redirect("/login?status=session-required");
  }

  const nextBlocked = String(formData.get("blocked") ?? "").toLowerCase() === "true";

  try {
    await client.setVehicleIgnitionBlock(vehicleId, { blocked: nextBlocked });
  } catch {
    return;
  }

  revalidatePath("/");
}

/**
 * 감사 로그를 DB에 기록하는 fire-and-forget 서버 액션.
 * 실패해도 호출자에게 영향을 주지 않는다.
 */
export async function recordAuditLogAction(input: AuditLogCreateInput): Promise<void> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return;
  await client.recordAuditLog(input).catch(() => undefined);
}

/**
 * 차량 상세 패널 VIEW 모드에서 운행 상태를 인라인으로 변경하는 서버 액션.
 * redirect 없이 결과를 반환하므로 호출자가 UI 를 즉시 업데이트할 수 있다.
 */
export async function changeVehicleOperationStatusInlineAction(
  vehicleId: string,
  nextStatus: ServiceOpsBikeOperationStatus,
  currentStatus: ServiceOpsBikeOperationStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (nextStatus === currentStatus) return { ok: true };

  if (!serviceOpsApiConfigured()) {
    return { ok: false, error: "서비스 API 가 설정되어 있지 않습니다." };
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) {
    return { ok: false, error: "session-required" };
  }

  try {
    await client.changeVehicleOperationStatus(vehicleId, {
      operationStatus: nextStatus,
      reason: "OPERATOR_INLINE_EDIT"
    });
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }

  // fire-and-forget audit log
  void recordAuditLogAction({
    entityType: "BIKE_OPERATION_STATUS",
    entityId: vehicleId,
    field: "operationStatus",
    oldValue: currentStatus,
    newValue: nextStatus
  });

  revalidatePath("/");
  revalidatePath("/management");
  return { ok: true };
}

function extractError(err: unknown): string {
  if (err instanceof ServiceOpsApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "알 수 없는 오류가 발생했습니다.";
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


/** returnTo 경로에 status 쿼리를 결합한다 — "?tab=..." 유무를 흡수. */
function withStatus(returnTo: string, status: string): string {
  return returnTo + (returnTo.includes("?") ? "&" : "?") + "status=" + status;
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
// 사실상 목록 안의 값만 들어오지만, 외부에서 잘못된 값이 들어와도 throw 하지 않고
// 그냥 backend default 에 위임.
function parseEngineType(value: FormDataEntryValue | null): ServiceOpsBikeEngineType | undefined {
  const text = String(value ?? "").trim();
  if (text === "ELECTRIC" || text === "ICE" || text === "LPG") return text;
  return undefined;
}

function parseRiderRole(value: FormDataEntryValue | null): ServiceOpsRiderRole | undefined {
  const text = String(value ?? "").trim();
  if (text === "RIDER" || text === "CLEANER") return text;
  return undefined;
}

// 숙련도는 초보/고수 2단계 (V58). 빈 값·미인식 값은 undefined = "바꾸지 않음".
// 미판정으로 되돌리기는 select 의 "NONE" → clearSkillLevel 플래그로 표현한다.
function parseSkillLevel(value: FormDataEntryValue | null): ServiceOpsRiderSkillLevel | undefined {
  const text = String(value ?? "").trim();
  if (text === "BEGINNER" || text === "EXPERT") return text;
  return undefined;
}

// 용도. 빈 값이면 undefined 로 두고 backend 의 DELIVERY default 에 위임한다 (V51).
// update 경로에서 undefined 는 "바꾸지 않음" 이라 기존 값이 유지된다.
function parsePurpose(value: FormDataEntryValue | null): ServiceOpsBikePurpose | undefined {
  const text = String(value ?? "").trim();
  if (text === "DELIVERY" || text === "CLEANING") return text;
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

/**
 * CLEANING 차량의 다음 고객 정보를 조회한다.
 * 설정되지 않았거나 오류 시 null 반환.
 */
export async function getNextCustomerAction(
  bikeId: string
): Promise<ServiceOpsBikeNextCustomer | null> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return null;
  return client.getBikeNextCustomer(bikeId).catch(() => null);
}

/**
 * CLEANING 차량의 다음 고객 정보를 저장한다.
 * NCP 지오코딩 → PUT /api/v1/bikes/{id}/next-customer.
 */
export async function setNextCustomerAction(
  bikeId: string,
  data: { customerName: string; customerPhone: string; address: string }
): Promise<{ ok: true; lat: number; lng: number } | { ok: false; error: string }> {
  const geocoded = await geocodeAddress(data.address);
  if (!geocoded) {
    return { ok: false, error: "주소를 찾을 수 없습니다. 다시 확인해주세요." };
  }

  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) {
    return { ok: false, error: "인증 세션이 만료됐습니다. 다시 로그인해주세요." };
  }

  try {
    await client.setBikeNextCustomer(bikeId, {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      address: data.address,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude
    } satisfies BikeNextCustomerUpsertInput);
    return { ok: true, lat: geocoded.latitude, lng: geocoded.longitude };
  } catch {
    return { ok: false, error: "저장 중 오류가 발생했습니다. 다시 시도해주세요." };
  }
}

// ── Generic notification actions ──

/**
 * 서버 알림 목록을 반환한다. 미인증 또는 오류 시 빈 배열 반환.
 */
export async function listNotificationsAction(): Promise<ServiceOpsNotification[]> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return [];
  return client.listNotifications().catch(() => []);
}

/**
 * 서버 알림을 확인(acknowledge) 처리한다.
 */
export async function acknowledgeNotificationAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return { ok: false, error: "session-required" };
  try {
    await client.acknowledgeNotification(id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}
