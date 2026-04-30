import assert from "node:assert/strict";
import test from "node:test";

import { mockVehicleUnconfiguredServiceDetail, mockVehicleUnavailableServiceDetail } from "./vehicle-data-core.ts";

const mockVehicles = [
  {
    assignmentStatus: "미배정",
    batteryPercent: 78,
    lastSeenAt: "3분 전",
    locationLabel: "강남역",
    model: "Thunder M1",
    plateNumber: "서울A-1001",
    slug: "seoul-a-1001",
    status: "대기"
  }
];

test("UUID vehicle detail falls back to visible mock detail when service session is missing", () => {
  const fallback = mockVehicleUnavailableServiceDetail(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mockVehicles,
    "서비스 API 세션 쿠키가 없어 mock 차량 상세를 표시합니다."
  );

  assert.equal(fallback?.source, "mock");
  assert.equal(fallback?.vehicle.slug, "seoul-a-1001");
  assert.match(fallback?.notice ?? "", /서비스 API 세션/);
});

test("UUID vehicle detail falls back to visible mock detail when service API base URL is unconfigured", () => {
  const fallback = mockVehicleUnconfiguredServiceDetail("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", mockVehicles);

  assert.equal(fallback?.source, "mock");
  assert.equal(fallback?.vehicle.slug, "seoul-a-1001");
  assert.match(fallback?.notice ?? "", /SERVICE_OPS_API_BASE_URL/);
});

test("non-UUID missing vehicle detail does not fabricate a fallback", () => {
  assert.equal(mockVehicleUnavailableServiceDetail("missing-slug", mockVehicles, "notice"), null);
});
