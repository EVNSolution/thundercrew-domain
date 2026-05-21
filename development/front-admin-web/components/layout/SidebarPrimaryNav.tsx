"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarNavItem {
  href: string;
  label: string;
  // 텍스트 이모지("▦") 또는 inline SVG JSX 둘 다 받을 수 있게 ReactNode 로
  // 둔다. `.sidebar-icon` 의 box 안에 그대로 박혀서 SVG 가 currentColor 로
  // 사이드바 색을 자동으로 따라간다.
  icon: ReactNode;
}

export function SidebarPrimaryNav({ items }: { items: ReadonlyArray<SidebarNavItem> }) {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav" aria-label="기본 메뉴">
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            className={`sidebar-link${isActive ? " is-active" : ""}`}
            href={item.href}
            title={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="sidebar-icon" aria-hidden="true">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
