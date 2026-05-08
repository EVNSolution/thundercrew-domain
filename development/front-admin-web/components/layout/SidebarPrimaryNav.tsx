"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: string;
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
