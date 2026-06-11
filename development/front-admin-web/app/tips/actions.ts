"use server";

import { revalidatePath } from "next/cache";

import type { ServiceOpsTip, TipUpsertPayload } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

/**
 * 운영 팁(메모) CRUD server actions. 팁은 대시보드 지도(`/`)에 핀으로 표시되므로
 * 생성/수정/삭제 후 `/` 를 revalidate 해 지도가 새 상태를 집어 들게 한다.
 *
 * 읽기(list) 는 세션이 없으면 빈 배열로 fail-soft — 호출 컴포넌트가 빈 목록을
 * 그대로 렌더한다. 변경(create/update/delete) 은 세션이 없으면 throw 해
 * 호출자(다이얼로그) 가 에러를 표면화하도록 한다.
 */

export async function listTipsAction(): Promise<ServiceOpsTip[]> {
  const client = await createAuthenticatedServiceOpsApiClient();
  if (!client) return [];
  try {
    const page = await client.listTips({ page: 0, size: 200 });
    return page.items;
  } catch {
    return [];
  }
}

export async function createTipAction(data: TipUpsertPayload): Promise<ServiceOpsTip> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) throw new Error("로그인이 필요합니다.");
  const tip = await client.createTip(data);
  revalidatePath("/");
  return tip;
}

export async function updateTipAction(id: string, data: TipUpsertPayload): Promise<ServiceOpsTip> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) throw new Error("로그인이 필요합니다.");
  const tip = await client.updateTip(id, data);
  revalidatePath("/");
  return tip;
}

export async function deleteTipAction(id: string): Promise<void> {
  const client = await createAuthenticatedServiceOpsApiClient({ refreshIfMissing: true });
  if (!client) throw new Error("로그인이 필요합니다.");
  await client.deleteTip(id);
  revalidatePath("/");
}
