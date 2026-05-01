import assert from "node:assert/strict";
import test from "node:test";

import {
  mockInsuranceItemUnavailableServiceDetail,
  toFrontendInsuranceItem
} from "./insurance-item-data-core.ts";

test("toFrontendInsuranceItem maps service item to route slug and display fields", () => {
  const item = toFrontendInsuranceItem({
    createdAt: "2026-04-30T00:00:00Z",
    description: "라이더 기본 책임보험",
    enabled: true,
    id: "11111111-1111-4111-8111-111111111111",
    idx: 3,
    name: "라이더 기본 보험",
    updatedAt: "2026-04-30T00:00:00Z"
  });

  assert.equal(item.slug, "11111111-1111-4111-8111-111111111111");
  assert.equal(item.name, "라이더 기본 보험");
  assert.equal(item.enabled, true);
  assert.equal(item.source, "service-ops");
});

test("UUID insurance item detail falls back to visible mock detail when service API is unavailable", () => {
  const detail = mockInsuranceItemUnavailableServiceDetail(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    [{ description: "mock item", enabled: true, name: "현대해상 라이더 기본", slug: "hyundai-rider-basic" }],
    "서비스 API 세션 쿠키가 없어 mock 보험 항목 상세를 표시합니다."
  );

  assert.equal(detail?.source, "mock");
  assert.equal(detail?.item.slug, "hyundai-rider-basic");
});
