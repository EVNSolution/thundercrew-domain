"use client";

import type { ServiceOpsBikeServiceType } from "@/lib/services/service-ops-api";

export type ServiceTypeFilter = ServiceOpsBikeServiceType | "ALL";

const TABS: { value: ServiceTypeFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "DELIVERY", label: "배송" },
  { value: "CLEANING", label: "클리닝" },
  { value: "OTHER", label: "기타" }
];

export function ServiceTypeFilterTabs({
  value,
  onChange
}: {
  value: ServiceTypeFilter;
  onChange: (value: ServiceTypeFilter) => void;
}) {
  return (
    <div className="service-type-tabs" role="tablist" aria-label="서비스 유형 필터">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={value === tab.value ? "service-type-tab is-active" : "service-type-tab"}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
