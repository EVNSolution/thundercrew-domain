import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { SidebarPrimaryNav, type SidebarNavItem } from "@/components/layout/SidebarPrimaryNav";
import { signOutAdmin } from "@/app/login/actions";
import { serviceOpsSessionReady } from "@/lib/services/service-ops-session";

// Overview is the unified management entry point - its tab nav covers
// the five primary domain hubs (라이더 / 차량 / 스테이션 / 계약 / 보험)
// so duplicating those entries in the sidebar would just send operators
// to the same data via two paths. Direct deep-link routes (/riders,
// /vehicles, etc.) still work via the "전체 관리 화면 →" button on each
// /overview tab, bookmarks, and direct URL entry.
//
// Monitoring 의 아이콘은 "접힌 지도 위에 핀이 박혀 있는" 형태 (NAVER 지도
// 의 장소 마커 시각화). 위쪽 핀(teardrop + 가운데 구멍) 과 아래쪽 사다리꼴
// 베이스(원근 표현된 종이 지도) 의 두 path 조합. stroke 기반이라 사이드바
// 의 currentColor + 1.8px 두께로 light/dark 테마 자동 적응.
const PinIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 17l8-2 8 2v3l-8 2-8-2v-3z" />
    <path d="M12 3a4 4 0 0 0-4 4c0 3 4 6 4 6s4-3 4-6a4 4 0 0 0-4-4z" />
    <circle cx="12" cy="7" r="1.5" />
  </svg>
);

const PRIMARY_NAV: ReadonlyArray<SidebarNavItem> = [
  { href: "/overview", label: "Overview", icon: "▦" },
  { href: "/monitoring", label: "Monitoring", icon: PinIcon },
];

export async function AppShell({ children }: { children: ReactNode }) {
  const serviceOpsSessionActive = await serviceOpsSessionReady();

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="주요 메뉴">
        <Link className="sidebar-brand" href="/overview" aria-label="Thundercrew 운영 화면">
          <span className="brand-mark">TC</span>
          <span className="sidebar-label">thundercrew-domain</span>
        </Link>

        <SidebarPrimaryNav items={PRIMARY_NAV} />

        <div className="sidebar-bottom">
          <ThemeToggle />
          {serviceOpsSessionActive ? (
            <form action={signOutAdmin} className="sidebar-action-form">
              <button className="sidebar-link sidebar-button" type="submit" title="관리자 로그아웃" aria-label="관리자 로그아웃">
                <span className="sidebar-icon" aria-hidden="true">↙</span>
                <span className="sidebar-label">관리자 로그아웃</span>
              </button>
            </form>
          ) : (
            <Link className="sidebar-link" href="/login" title="관리자 로그인" aria-label="관리자 로그인">
              <span className="sidebar-icon" aria-hidden="true">↗</span>
              <span className="sidebar-label">관리자 로그인</span>
            </Link>
          )}
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
