"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { serviceOpsApiConfigured } from "@/lib/services/service-ops-api";
import { createAuthenticatedServiceOpsApiClient } from "@/lib/services/service-ops-session";

/**
 * `/monitoring` 의 `BikeDetailPanel` 에서 호출하는 시동 방지 토글 액션.
 * `/overview` 쪽 동명 액션과 동작은 같지만 redirect / revalidate 가
 * `/monitoring` 컨텍스트로 맞춰져 있다 — 운영자가 지도에서 마커 클릭한
 * 상태로 토글을 눌렀을 때 `/overview?tab=riders` 로 끌려가지 않고 그 자리에
 * 머무르도록.
 *
 * 성공 시 redirect 하지 않고 그냥 revalidate 만 한다 — 폴링 다음 tick
 * 에 새 ignitionBlocked 값이 반영되고, optimistic state 가 그 사이를
 * 메워준다.
 */
export async function setVehicleIgnitionBlockFromMonitoringAction(
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
    // 실패 시 호출 측의 optimistic state 가 다음 폴링/리렌더에서
    // 서버 진실값으로 정정된다. 별도 status flag 는 안 박는다 —
    // /monitoring 는 query string 기반 notice 채널이 없고, 운영자에게는
    // "변경이 안 됐다" 라는 시각적 정정만으로 충분.
    return;
  }

  revalidatePath("/monitoring");
}
