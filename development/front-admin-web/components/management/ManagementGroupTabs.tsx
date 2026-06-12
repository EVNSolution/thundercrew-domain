"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/management/resources", label: "자원 관리" },
  { href: "/management/operations", label: "업무 관리" }
];

/** 자원 관리 / 업무 관리 두 페이지 전환 상단 탭. */
export function ManagementGroupTabs() {
  const pathname = usePathname();
  return (
    <nav className="management-group-tabs" aria-label="관리 그룹">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`management-group-tab${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
