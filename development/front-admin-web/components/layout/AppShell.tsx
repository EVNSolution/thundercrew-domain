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
// Monitoring 의 아이콘은 Material Symbols 'place' (location pin) 를 inline
// SVG 로 그린다. 외부 아이콘 라이브러리 의존 없이 currentColor 로 사이드바
// 텍스트 색을 따라가게 해서 light/dark 테마에 자동 적응.
const PinIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
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
