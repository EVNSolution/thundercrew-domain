export type ManagementGroupKey = "vehicles" | "riders" | "contracts" | "stations";

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

export const managementGroups = {
  vehicles: {
    href: "/vehicles",
    icon: "EV",
    items: [
      { href: "/vehicles", label: "차량" },
      { href: "/vehicles/new", label: "차량 등록" },
      { href: "/equipment", label: "장비" },
      { href: "/equipment/types/new", label: "장비 종류" },
      { href: "/devices", label: "단말" },
      { href: "/devices/installations/new", label: "단말 설치" }
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
      { href: "/riders/new", label: "라이더 등록" },
      { href: "/insurance", label: "보험 연결" },
      { href: "/insurance/items", label: "보험 항목" }
    ],
    key: "riders",
    label: "라이더 관리",
    routePrefixes: ["/riders", "/insurance"]
  },
  contracts: {
    href: "/contracts",
    icon: "C",
    items: [
      { href: "/contracts", label: "계약" },
      { href: "/contracts/new", label: "계약 등록" },
      { href: "/contract-templates", label: "계약 양식" }
    ],
    key: "contracts",
    label: "계약 관리",
    routePrefixes: ["/contracts", "/contract-templates"]
  },
  stations: {
    href: "/stations",
    icon: "S",
    items: [
      { href: "/stations", label: "스테이션" },
      { href: "/stations/new", label: "스테이션 등록" }
    ],
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
