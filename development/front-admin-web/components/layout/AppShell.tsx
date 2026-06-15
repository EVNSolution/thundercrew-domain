import type { ReactNode } from "react";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { PasswordChangeButton } from "@/components/layout/PasswordChangeButton";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { SidebarPrimaryNav, type SidebarNavItem } from "@/components/layout/SidebarPrimaryNav";
import { serviceOpsSessionReady } from "@/lib/services/service-ops-session";

const NAV: SidebarNavItem[] = [
  {
    href: "/",
    label: "지도",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" />
        <path d="M9 4v13M15 6.5v13" />
      </svg>
    )
  },
  {
    href: "/management/resources",
    label: "자원 관리",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 7v10l9 4 9-4V7" />
        <path d="M12 11v10" />
      </svg>
    )
  },
  {
    href: "/management/operations",
    label: "업무 관리",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3h6v1M8.5 10h7M8.5 14h7M8.5 18h4" />
      </svg>
    )
  },
  {
    href: "/management/maintenance",
    label: "정비 관리",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.7-.7-2.5 2.4-2.3z" />
      </svg>
    )
  }
];

export async function AppShell({ children }: { children: ReactNode }) {
  const serviceOpsSessionActive = await serviceOpsSessionReady();

  return (
    <div className={`app-frame${serviceOpsSessionActive ? " has-rail" : ""}`}>
      {serviceOpsSessionActive ? (
        <aside className="app-rail" aria-label="기본 메뉴">
          <SidebarPrimaryNav items={NAV} />
        </aside>
      ) : null}
      <div className="top-actions" aria-label="유틸리티">
        <ThemeToggle />
        {serviceOpsSessionActive ? (
          <>
            <PasswordChangeButton />
            <LogoutButton />
          </>
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
