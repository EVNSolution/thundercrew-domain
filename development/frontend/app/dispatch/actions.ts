"use server";

import { revalidatePath } from "next/cache";

import {
  ServiceOpsApiError,
  serviceOpsApiConfigured,
  type DeliveryCallPayload,
  type DispatchBulkApplyRow,
  type DispatchBulkPreviewRow,
  type DispatchBulkSummary,
  type DispatchOrderUpdatePayload,
  type ReignitionNotificationCreateInput,
  type ServiceOpsDispatchOrder,
  type ServiceOpsReignitionNotification
} from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";
import { geocodeAddress } from "@/lib/services/ncp-geocoder";

/**
 * 배차(dispatch) server actions. 배차 일괄 업로드는 HYBRID 플로우다 — 지오코딩은
 * NCP secret 을 쓰는 서버 전용 모듈(`ncp-geocoder`)이라 client component 에서
 * 못 돌린다. 그래서 좌표 변환을 여기 server action 안에서 수행한다:
 *   1. backend `previewDispatchOrders(file)` 로 xlsx 파싱 + 차량번호 검증 → 행들.
 *   2. 본 액션이 NEW 행의 `address` 를 `geocodeAddress` 로 좌표 변환. 실패 행은
 *      ERROR 로 강등.
 *   3. 운영자 확인 → `applyDispatchOrders(rows)` (좌표 포함 JSON) → 적용 건수.
 *
 * 변경 후 `/management`(배차 섹션 테이블)와 `/`(대시보드 지도) 를 revalidate 한다.
 * 결과는 throw 대신 `{ ok, ... } | { ok: false, error }` 객체로 — Next.js 프로덕션이
 * server action 예외를 generic digest 로 마스킹하므로 backend 검증 메시지를 그대로
 * 노출하려면 결과 객체로 전달해야 한다 (tips actions 와 동일 idiom).
 */

function extractError(err: unknown): string {
  if (err instanceof ServiceOpsApiError) return err.message;
  return "처리 중 오류가 발생했습니다. 다시 시도해주세요.";
}

/** 지오코딩까지 끝난 미리보기 행 — 성공한 NEW 행에 좌표가 붙는다. */
export type DispatchPreviewRow = DispatchBulkPreviewRow & {
  latitude?: number;
  longitude?: number;
  originLatitude?: number;
  originLongitude?: number;
  sequence?: number | null;
};

export type DispatchPreviewResult =
  | { ok: true; rows: DispatchPreviewRow[]; summary: DispatchBulkSummary }
  | { ok: false; error: string };

export async function previewDispatchAction(formData: FormData): Promise<DispatchPreviewResult> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "업로드할 파일이 없습니다." };

  try {
    const preview = await client.previewDispatchOrders(file);

    // NEW 행만 지오코딩. 변환 실패 시 해당 행을 ERROR 로 강등하고 사유를 남긴다 —
    // 좌표 없이 apply 로 넘기면 backend 가 거부하므로 미리보기에서 걸러준다.
    const rows: DispatchPreviewRow[] = await Promise.all(
      preview.rows.map(async (row): Promise<DispatchPreviewRow> => {
        if (row.status !== "NEW") return row;
        const coords = await geocodeAddress(row.address);
        if (!coords) {
          return { ...row, status: "ERROR", message: "주소 변환 실패" };
        }
        let originLatitude: number | undefined;
        let originLongitude: number | undefined;
        if (row.originAddress && row.originAddress.trim()) {
          const origin = await geocodeAddress(row.originAddress);
          if (!origin) {
            return { ...row, status: "ERROR", message: "출발지 주소 변환 실패" };
          }
          originLatitude = origin.latitude;
          originLongitude = origin.longitude;
        }
        return { ...row, latitude: coords.latitude, longitude: coords.longitude, originLatitude, originLongitude };
      })
    );

    // 지오코딩 강등으로 NEW/ERROR 집계가 바뀌므로 summary 를 다시 센다.
    const newCount = rows.filter((r) => r.status === "NEW").length;
    const errorCount = rows.filter((r) => r.status === "ERROR").length;
    const summary: DispatchBulkSummary = {
      total: rows.length,
      new: newCount,
      error: errorCount
    };

    return { ok: true, rows, summary };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}

export async function applyDispatchAction(
  rows: DispatchBulkApplyRow[]
): Promise<{ ok: true; applied: number } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };

  try {
    const result = await client.applyDispatchOrders(rows);
    revalidatePath("/management");
    revalidatePath("/");
    return { ok: true, applied: result.applied };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}

export async function previewSequentialDispatchAction(formData: FormData): Promise<DispatchPreviewResult> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "업로드할 파일이 없습니다." };

  try {
    const preview = await client.previewSequentialDispatchOrders(file);

    // NEW 행만 지오코딩. 변환 실패 시 해당 행을 ERROR 로 강등하고 사유를 남긴다 —
    // 좌표 없이 apply 로 넘기면 backend 가 거부하므로 미리보기에서 걸러준다.
    const rows: DispatchPreviewRow[] = await Promise.all(
      preview.rows.map(async (row): Promise<DispatchPreviewRow> => {
        if (row.status !== "NEW") return row;
        const coords = await geocodeAddress(row.address);
        if (!coords) {
          return { ...row, status: "ERROR", message: "주소 변환 실패" };
        }
        let originLatitude: number | undefined;
        let originLongitude: number | undefined;
        if (row.originAddress && row.originAddress.trim()) {
          const origin = await geocodeAddress(row.originAddress);
          if (!origin) {
            return { ...row, status: "ERROR", message: "출발지 주소 변환 실패" };
          }
          originLatitude = origin.latitude;
          originLongitude = origin.longitude;
        }
        return { ...row, latitude: coords.latitude, longitude: coords.longitude, originLatitude, originLongitude };
      })
    );

    // 지오코딩 강등으로 NEW/ERROR 집계가 바뀌므로 summary 를 다시 센다.
    const newCount = rows.filter((r) => r.status === "NEW").length;
    const errorCount = rows.filter((r) => r.status === "ERROR").length;
    const summary: DispatchBulkSummary = {
      total: rows.length,
      new: newCount,
      error: errorCount
    };

    return { ok: true, rows, summary };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}

export async function applySequentialDispatchAction(
  rows: DispatchBulkApplyRow[]
): Promise<{ ok: true; applied: number } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };

  try {
    const result = await client.applySequentialDispatchOrders(rows);
    revalidatePath("/management/operations");
    revalidatePath("/");
    return { ok: true, applied: result.applied };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}

/**
 * 한 차량의 배차 주문 목록을 조회한다 (차량 상세 "배차 큐" 섹션용). API client 는
 * 서버 전용 인증을 쓰므로 client component 에서 직접 못 부른다 — getNextCustomerAction
 * 과 동일하게 server action 으로 감싸고, 미인증/오류 시 빈 배열을 반환한다.
 */
export async function listDispatchOrdersAction(
  bikeId: string
): Promise<ServiceOpsDispatchOrder[]> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return [];
  return client.listDispatchOrders(bikeId).catch(() => []);
}

export async function listActiveDispatchOrdersAction(): Promise<ServiceOpsDispatchOrder[]> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return [];
  return client.listActiveDispatchOrders().catch(() => []);
}

export async function completeDispatchOrderAction(
  id: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };

  const photo = formData.get("photo");
  if (!(photo instanceof File)) return { ok: false, error: "사진이 필요합니다." };

  try {
    await client.completeDispatchOrder(id, photo);
    revalidatePath("/management");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}

export async function listCompletedDispatchOrdersAction(
  bikeId: string
): Promise<ServiceOpsDispatchOrder[]> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return [];
  return client.listCompletedDispatchOrders(bikeId).catch(() => []);
}

export async function cancelDispatchOrderAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };

  try {
    await client.cancelDispatchOrder(id);
    revalidatePath("/management");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}

export async function updateDispatchOrderAction(
  id: string,
  input: { bikeId: string; customerName: string; customerPhone: string; address: string; sequence?: number | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };

  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.trim();
  const address = input.address.trim();
  if (!input.bikeId || !customerName || !customerPhone || !address) {
    return { ok: false, error: "모든 항목을 입력해주세요." };
  }
  const coords = await geocodeAddress(address);
  if (!coords) return { ok: false, error: "주소를 찾을 수 없습니다. 다시 확인해주세요." };

  try {
    const payload: DispatchOrderUpdatePayload = {
      bikeId: input.bikeId,
      customerName,
      customerPhone,
      address,
      latitude: coords.latitude,
      longitude: coords.longitude,
      sequence: input.sequence ?? null
    };
    await client.updateDispatchOrder(id, payload);
    revalidatePath("/management/operations");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}

export async function listDispatchMonitorAction(): Promise<ServiceOpsDispatchOrder[]> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return [];
  return client.listDispatchMonitor().catch(() => []);
}




async function geocodeCallForm(
  formData: FormData
): Promise<{ ok: true; payload: DeliveryCallPayload } | { ok: false; error: string }> {
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!customerName || !customerPhone || !address) {
    return { ok: false, error: "모든 항목을 입력해주세요." };
  }
  const coords = await geocodeAddress(address);
  if (!coords) return { ok: false, error: "주소를 찾을 수 없습니다. 다시 확인해주세요." };
  return { ok: true, payload: { customerName, customerPhone, address, latitude: coords.latitude, longitude: coords.longitude } };
}

export async function createSystemCallAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };
  const geo = await geocodeCallForm(formData);
  if (!geo.ok) return geo;
  try {
    await client.systemDispatchCall(geo.payload);
    revalidatePath("/management");
    revalidatePath("/");
    return { ok: true };
  } catch (err) { return { ok: false, error: extractError(err) }; }
}

export async function createOfferedCallAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };
  const geo = await geocodeCallForm(formData);
  if (!geo.ok) return geo;
  try {
    await client.offerCall(geo.payload);
    revalidatePath("/management");
    revalidatePath("/");
    return { ok: true };
  } catch (err) { return { ok: false, error: extractError(err) }; }
}

export async function acceptCallAction(
  orderId: string,
  bikeId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };
  try {
    await client.acceptCall(orderId, bikeId);
    revalidatePath("/management");
    revalidatePath("/");
    return { ok: true };
  } catch (err) { return { ok: false, error: extractError(err) }; }
}

export async function listOfferedCallsAction(): Promise<ServiceOpsDispatchOrder[]> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return [];
  return client.listOfferedCalls().catch(() => []);
}

// ── Re-ignition notifications ──

/**
 * 시동 ON 이벤트를 서버에 기록한다 (fire-and-forget). 인증 없거나 실패해도 무시.
 */
export async function recordReignitionNotificationAction(
  input: ReignitionNotificationCreateInput
): Promise<void> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return;
  await client.recordReignitionNotification(input).catch(() => undefined);
}

/**
 * 최근 re-ignition 알림 목록을 반환한다 (앱 로드 시 벨 초기화용).
 * 미인증 또는 오류 시 빈 배열 반환.
 */
export async function listReignitionNotificationsAction(): Promise<ServiceOpsReignitionNotification[]> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return [];
  return client.listReignitionNotifications().catch(() => []);
}

// ── 3단계: 클리닝 시간 배차 + 완료 수동 조작 ────────────────────────

export type CleaningDispatchInput = {
  bikeId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  /** KST 달력 날짜+시각 "YYYY-MM-DDTHH:mm" — 서버에서 Instant 로 변환. */
  scheduledAtLocal: string;
  serviceMinutes?: number | null;
};

/**
 * 클리닝 시간 배차 단건 등록. 주소는 서버에서 지오코딩한다 (엑셀·콜 경로와
 * 동일 규칙). 충돌(같은 차량 시간 겹침)·용도 검증은 백엔드가 400 으로 거부.
 */
export async function createCleaningDispatchAction(
  input: CleaningDispatchInput
): Promise<{ ok: boolean; message?: string }> {
  if (!serviceOpsApiConfigured()) return { ok: false, message: "서버가 구성되지 않았습니다." };
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, message: "세션이 만료됐습니다." };
  const geocoded = await geocodeAddress(input.address);
  if (!geocoded) {
    return { ok: false, message: "주소 지오코딩에 실패했습니다. 주소를 확인하세요." };
  }
  try {
    await client.createDispatchOrder({
      bikeId: input.bikeId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      address: input.address,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      // 운영 시간대는 KST 고정 — 달력 값에 +09:00 을 명시해 서버·표시가
      // 같은 벽시계를 가리키게 한다.
      scheduledAt: new Date(input.scheduledAtLocal + ":00+09:00").toISOString(),
      serviceMinutes: input.serviceMinutes ?? null
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: extractError(error) };
  }
}

/** 클리닝 일정표 — KST 달력 날짜 하루 범위의 시간 배차 전건. */
export async function listCleaningScheduleAction(
  dateLocal: string
): Promise<ServiceOpsDispatchOrder[]> {
  if (!serviceOpsApiConfigured()) return [];
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return [];
  const from = new Date(dateLocal + "T00:00:00+09:00");
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return client.listDispatchSchedule(from.toISOString(), to.toISOString());
}

/** 수동 완료 (사진 없음) — 모니터 완료 버튼·추정 불가 차량용. */
export async function completeDispatchManualAction(
  id: string
): Promise<{ ok: boolean; message?: string }> {
  if (!serviceOpsApiConfigured()) return { ok: false, message: "서버가 구성되지 않았습니다." };
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, message: "세션이 만료됐습니다." };
  try {
    await client.completeDispatchOrderManual(id);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: extractError(error) };
  }
}

/** 완료 되돌리기 — 자동 추정 오판·실수 정정. */
export async function revertDispatchCompletionAction(
  id: string
): Promise<{ ok: boolean; message?: string }> {
  if (!serviceOpsApiConfigured()) return { ok: false, message: "서버가 구성되지 않았습니다." };
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, message: "세션이 만료됐습니다." };
  try {
    await client.revertDispatchOrderCompletion(id);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: extractError(error) };
  }
}
