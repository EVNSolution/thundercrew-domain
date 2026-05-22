import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { signOutAdmin } from "@/app/login/actions";
import { serviceOpsSessionReady } from "@/lib/services/service-ops-session";

/**
 * 운영 콘솔의 외곽 셸. 한 화면(`/overview`) 으로 통합하면서 좌측 메뉴 레일을
 * 없애고, 테마 전환과 로그아웃만 우상단에 floating 액션 바로 떠 있는 형태로
 * 단순화했다. 다른 라우트(`/login` 등) 는 자체 레이아웃을 갖되 이 액션 바는
 * 공통으로 따라온다.
 *
 * `.top-actions` 는 `position: fixed` 라 레이아웃 너비를 차지하지 않는다 —
 * 본문(`main`) 의 가운데 정렬 기준이 사이드바 없을 때와 동일하게 유지됨.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const serviceOpsSessionActive = await serviceOpsSessionReady();

  return (
    <div className="app-frame">
      <div className="top-actions" aria-label="유틸리티">
        <ThemeToggle />
        {serviceOpsSessionActive ? (
          <form action={signOutAdmin} className="top-actions-form">
            <button
              className="sidebar-link"
              type="submit"
              title="관리자 로그아웃"
              aria-label="관리자 로그아웃"
            >
              <span className="sidebar-icon" aria-hidden="true">↙</span>
              <span className="sidebar-label">관리자 로그아웃</span>
            </button>
          </form>
        ) : (
          <a className="sidebar-link" href="/login" title="관리자 로그인" aria-label="관리자 로그인">
            <span className="sidebar-icon" aria-hidden="true">↗</span>
            <span className="sidebar-label">관리자 로그인</span>
          </a>
        )}
      </div>
      <main className="app-main">{children}</main>
    </div>
  );
}
