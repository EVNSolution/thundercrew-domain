import { DashboardCanvas } from "@/components/dashboard/DashboardCanvas";
import { loadDashboardMapState } from "@/lib/services/dashboard-map-state-data";

// `loadDashboardMapState` 가 `cookies()` 기반의 인증 클라이언트를 사용한다.
// Next.js 의 자동 dynamic 감지가 어떤 빌드 경로에선 이 페이지를 정적
// 렌더 대상으로 잡고 — request time 에 `DYNAMIC_SERVER_USAGE` 로 throw 한다
// (`prod` /dashboard 가 500 으로 떨어지던 원인). `/overview` 와 동일하게
// 명시적으로 force-dynamic 선언해서 어떤 빌드/배포 조합에서도 항상 dynamic
// 렌더로 잠근다.
export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const initial = await loadDashboardMapState();

  return (
    <section className="control-map-page" aria-label="지도 기반 관제">
      <DashboardCanvas initial={initial} />
    </section>
  );
}
