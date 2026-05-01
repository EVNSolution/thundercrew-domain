import type { InsuranceItem } from "@/types/domain";
import type { ServiceOpsInsuranceItem } from "./service-ops-api";

export type InsuranceItemDataResult = {
  items: InsuranceItem[];
  notice?: string;
  source: "mock" | "service-ops";
};

export type InsuranceItemDetailResult = {
  item: InsuranceItem;
  notice?: string;
  source: "mock" | "service-ops";
};

export function toFrontendInsuranceItem(item: ServiceOpsInsuranceItem): InsuranceItem {
  return {
    createdAt: item.createdAt,
    description: item.description,
    enabled: item.enabled,
    id: item.id,
    idx: item.idx,
    name: item.name,
    slug: item.id,
    source: "service-ops",
    updatedAt: item.updatedAt
  };
}

export function mockInsuranceItemList(mockItems: InsuranceItem[]): InsuranceItemDataResult {
  return {
    items: mockItems.map((item) => ({ ...item, source: "mock" as const })),
    source: "mock"
  };
}

export function mockInsuranceItemDetail(slug: string, mockItems: InsuranceItem[]): InsuranceItemDetailResult | null {
  const item = mockItems.find((candidate) => candidate.slug === slug);
  if (!item) {
    return null;
  }

  return {
    item: { ...item, source: "mock" },
    source: "mock"
  };
}

export function mockInsuranceItemUnavailableServiceDetail(
  slug: string,
  mockItems: InsuranceItem[],
  notice: string
): InsuranceItemDetailResult | null {
  const exactFallback = mockInsuranceItemDetail(slug, mockItems);
  if (exactFallback) {
    return { ...exactFallback, notice };
  }

  if (!isUuidLike(slug) || !mockItems.length) {
    return null;
  }

  return {
    item: { ...mockItems[0], source: "mock" },
    notice,
    source: "mock"
  };
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
