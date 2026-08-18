"use client";

import type { ServiceOpsBikePurpose } from "@/lib/services/service-ops-api";

export type PurposeFilter = ServiceOpsBikePurpose | "ALL";

/**
 * 지도 헤더의 용도 필터. 배차 방식 탭(콜/단일/순차/왕복/기타)을 대체한다 —
 * 배차 방식 축은 용도 단일화(V59)로 사라졌고, 운영 축은 배송/클리닝 둘뿐이다.
 */
const TABS: { value: PurposeFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "DELIVERY", label: "배송" },
  { value: "CLEANING", label: "클리닝" }
];

export function PurposeFilterTabs({
  value,
  onChange
}: {
  value: PurposeFilter;
  onChange: (value: PurposeFilter) => void;
}) {
  return (
    <div className="service-type-tabs" role="tablist" aria-label="용도 필터">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={`service-type-tab${value === tab.value ? " is-active" : ""}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
