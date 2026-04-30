import Link from "next/link";

import { managementGroups, type ManagementGroupKey } from "@/lib/navigation/management-navigation";

export function ManagementSubnav({ activeHref, groupKey }: { activeHref: string; groupKey: ManagementGroupKey }) {
  const group = managementGroups[groupKey];

  return (
    <nav className="management-subnav" aria-label={`${group.label} 하위 메뉴`}>
      {group.items.map((item) => (
        <Link
          key={item.href}
          aria-current={item.href === activeHref ? "page" : undefined}
          className={`management-subnav-link${item.href === activeHref ? " is-active" : ""}`}
          href={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
