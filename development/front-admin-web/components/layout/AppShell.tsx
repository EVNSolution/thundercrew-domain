import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { SidebarPrimaryNav, type SidebarNavItem } from "@/components/layout/SidebarPrimaryNav";
import { signOutAdmin } from "@/app/login/actions";
import { serviceOpsSessionReady } from "@/lib/services/service-ops-session";

const PRIMARY_NAV: ReadonlyArray<SidebarNavItem> = [
  { href: "/overview", label: "Overview", icon: "▦" },
  { href: "/dashboard", label: "Monitoring", icon: "🗺" },
  { href: "/riders", label: "Riders", icon: "👤" },
  { href: "/vehicles", label: "Vehicles", icon: "🛵" },
  { href: "/stations", label: "Stations", icon: "🔋" },
  { href: "/contracts", label: "Contracts", icon: "📄" },
  { href: "/insurance", label: "Insurance", icon: "🛡" },
];

export async function AppShell({ children }: { children: ReactNode }) {
  const serviceOpsSessionActive = await serviceOpsSessionReady();

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="주요 메뉴">
        <Link className="sidebar-brand" href="/dashboard" aria-label="Thundercrew 관제 화면">
          <span className="brand-mark">TC</span>
          <span className="sidebar-label">thundercrew-domain</span>
        </Link>

        <SidebarPrimaryNav items={PRIMARY_NAV} />

        <div className="sidebar-bottom">
          <Link className="sidebar-link" href="/settings" title="설정" aria-label="설정">
            <span className="sidebar-icon" aria-hidden="true">⚙</span>
            <span className="sidebar-label">설정</span>
          </Link>
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
