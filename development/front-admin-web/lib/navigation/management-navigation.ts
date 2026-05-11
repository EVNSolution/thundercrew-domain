export type ManagementGroupKey = "vehicles" | "riders" | "stations";

export type ManagementNavItem = {
  href: string;
  icon?: string;
  label: string;
};

export type ManagementGroup = {
  href: string;
  icon: string;
  items: ManagementNavItem[];
  key: ManagementGroupKey;
  label: string;
  routePrefixes: string[];
};

// Rider-centric refactor (#162, #164, #166):
// - "contracts" group removed - rider contracts are managed inline on
//   /riders/[slug]. /contract-templates lives outside the management
//   subnav now (the master-data catalog page renders standalone).
// - "보험 연결" entry under riders removed - rider insurance is also
//   managed inline on /riders/[slug]. The /insurance/items master-data
//   catalog stays as a sub-entry under 라이더 관리.
export const managementGroups = {
  vehicles: {
    href: "/vehicles",
    icon: "EV",
    items: [
      { href: "/vehicles", label: "차량" },
      { href: "/equipment", label: "장비" },
      { href: "/devices", label: "단말" }
    ],
    key: "vehicles",
    label: "차량 관리",
    routePrefixes: ["/vehicles", "/equipment", "/devices"]
  },
  riders: {
    href: "/riders",
    icon: "R",
    items: [
      { href: "/riders", label: "라이더" },
      { href: "/insurance/items", label: "보험 항목" }
    ],
    key: "riders",
    label: "라이더 관리",
    routePrefixes: ["/riders", "/insurance/items"]
  },
  stations: {
    href: "/stations",
    icon: "S",
    items: [{ href: "/stations", label: "스테이션" }],
    key: "stations",
    label: "스테이션 관리",
    routePrefixes: ["/stations"]
  }
} satisfies Record<ManagementGroupKey, ManagementGroup>;

export const sidebarManagementItems = Object.values(managementGroups).map(({ href, icon, key, label }) => ({
  href,
  icon,
  key,
  label
}));

export function resolveManagementGroupForHref(href: string): ManagementGroupKey | null {
  const normalized = normalizeHref(href);
  const group = Object.values(managementGroups).find((candidate) =>
    candidate.routePrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))
  );

  return group?.key ?? null;
}

function normalizeHref(href: string): string {
  if (href === "/") {
    return href;
  }

  return href.split("?")[0]?.replace(/\/$/, "") || href;
}
