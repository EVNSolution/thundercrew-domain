import { redirect } from "next/navigation";

import { serviceOpsSessionReady } from "@/lib/services/service-ops-session";

/**
 * 루트 진입은 세션 유무에 따라 분기. 로그인 안 된 상태면 바로 `/login` 으로
 * 보내 운영자가 "어디로 가야 하지?" 를 고민하지 않게 한다. 세션이 살아
 * 있으면 단일 운영 페이지(`/overview`) 로 이동.
 *
 * `serviceOpsSessionReady` 가 API 환경이 설정되어 있고 access / refresh 쿠키
 * 가 유효한지 확인하므로, 만료된 세션은 자동으로 false 반환 → `/login` 으로
 * 떨어진다.
 */
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const sessionActive = await serviceOpsSessionReady();
  redirect(sessionActive ? "/overview" : "/login");
}
