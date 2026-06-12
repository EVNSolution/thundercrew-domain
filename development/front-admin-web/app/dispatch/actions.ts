"use server";

import { revalidatePath } from "next/cache";

import {
  ServiceOpsApiError,
  type DeliveryCallPayload,
  type DispatchBulkApplyRow,
  type DispatchBulkPreviewRow,
  type DispatchBulkSummary,
  type ServiceOpsDispatchOrder,
  type ServiceOpsDispatchRound
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
        return { ...row, latitude: coords.latitude, longitude: coords.longitude };
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

export async function completeDispatchOrderAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };

  try {
    await client.completeDispatchOrder(id);
    revalidatePath("/management");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
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

export async function getActiveRoundAction(): Promise<ServiceOpsDispatchRound | null> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return null;
  return client.getActiveDispatchRound().catch(() => null);
}

export async function createRoundAction(
  rows: DispatchBulkApplyRow[]
): Promise<{ ok: true; round: ServiceOpsDispatchRound } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };
  try {
    const round = await client.createDispatchRound(rows);
    revalidatePath("/management");
    revalidatePath("/");
    return { ok: true, round };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}

export async function startDeliveryAction(
  batchId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };
  try {
    await client.startDispatchDelivery(batchId);
    revalidatePath("/management");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
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
