"use server";

import { revalidatePath } from "next/cache";

import { ServiceOpsApiError, type ServiceOpsTip, type TipUpsertPayload } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

/**
 * 운영 팁(메모) CRUD server actions. 팁은 대시보드 지도(`/`)에 핀으로 표시되므로
 * 생성/수정/삭제 후 `/` 를 revalidate 해 지도가 새 상태를 집어 들게 한다.
 *
 * 읽기(list) 는 세션이 없으면 빈 배열로 fail-soft — 호출 컴포넌트가 빈 목록을
 * 그대로 렌더한다. 변경(create/update/delete) 은 redirect 를 던지지 않고 결과를
 * 객체(`{ ok, ... } | { ok: false, error }`)로 돌려준다 — 호출자(다이얼로그) 가
 * `err.message` 대신 결과의 `error` 를 표면화하도록 하기 위함. Next.js 프로덕션은
 * server action 이 throw 한 에러를 generic digest 로 마스킹하므로 backend
 * 검증 메시지를 그대로 노출하려면 결과 객체로 전달해야 한다.
 */

// ServiceOpsApiError 면 backend 가 내려준 message (검증 사유) 를 그대로,
// 그 외 예외면 generic 문구로 폴백. sibling 액션들의 `err instanceof
// ServiceOpsApiError` 분기와 동일한 idiom.
function extractError(err: unknown): string {
  if (err instanceof ServiceOpsApiError) return err.message;
  return "저장 중 오류가 발생했습니다. 다시 시도해주세요.";
}

export async function listTipsAction(): Promise<ServiceOpsTip[]> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: false });
  if (!client) return [];
  try {
    const page = await client.listTips({ page: 0, size: 200 });
    return page.items;
  } catch {
    return [];
  }
}

export async function createTipAction(
  data: TipUpsertPayload
): Promise<{ ok: true; tip: ServiceOpsTip } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };
  try {
    const tip = await client.createTip(data);
    revalidatePath("/");
    return { ok: true, tip };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}

export async function updateTipAction(
  id: string,
  data: TipUpsertPayload
): Promise<{ ok: true; tip: ServiceOpsTip } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };
  try {
    const tip = await client.updateTip(id, data);
    revalidatePath("/");
    return { ok: true, tip };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}

export async function deleteTipAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) return { ok: false, error: "로그인이 필요합니다." };
  try {
    await client.deleteTip(id);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: extractError(err) };
  }
}
