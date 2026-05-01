import type { ReactNode } from "react";
import Link from "next/link";
import { SidebarToggle } from "@/components/layout/SidebarToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { signOutAdmin } from "@/app/login/actions";
import { serviceOpsSessionReady } from "@/lib/services/service-ops-session";
import { sidebarManagementItems } from "@/lib/navigation/management-navigation";

export async function AppShell({ children }: { children: ReactNode }) {
  const serviceOpsSessionActive = await serviceOpsSessionReady();

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="주요 메뉴">
        <div className="sidebar-top">
          <Link className="sidebar-brand" href="/dashboard" aria-label="Thundercrew 관제 화면">
            <span className="brand-mark">T</span>
            <span className="sidebar-label">thundercrew-domain</span>
          </Link>
          <SidebarToggle />
        </div>

        <nav className="sidebar-nav">
          <Link className="sidebar-link sidebar-link-primary" href="/dashboard" title="지도 관제">
            <span className="sidebar-icon">⌖</span>
            <span className="sidebar-label">지도 관제</span>
          </Link>

          <div className="sidebar-group">
            <p className="sidebar-group-label">운영 관리</p>
            {sidebarManagementItems.map((item) => (
              <Link key={item.href} className="sidebar-link" href={item.href} title={item.label}>
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="sidebar-bottom">
          <ThemeToggle />
          <Link className="sidebar-link" href="/integrity" title="무결성 점검">
            <span className="sidebar-icon">Q</span>
            <span className="sidebar-label">무결성 점검</span>
          </Link>
          <Link className="sidebar-link" href="/settings" title="설정">
            <span className="sidebar-icon">⚙</span>
            <span className="sidebar-label">설정</span>
          </Link>
          {serviceOpsSessionActive ? (
            <form action={signOutAdmin} className="sidebar-action-form">
              <button className="sidebar-link sidebar-button" type="submit" title="관리자 로그아웃">
                <span className="sidebar-icon">↙</span>
                <span className="sidebar-label">관리자 로그아웃</span>
              </button>
            </form>
          ) : (
            <Link className="sidebar-link" href="/login" title="관리자 로그인">
              <span className="sidebar-icon">↗</span>
              <span className="sidebar-label">관리자 로그인</span>
            </Link>
          )}
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
