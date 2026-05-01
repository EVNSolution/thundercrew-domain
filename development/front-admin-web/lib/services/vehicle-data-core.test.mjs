import assert from "node:assert/strict";
import test from "node:test";

import {
  loadVehicleOperationHistoryRows,
  mockVehicleUnconfiguredServiceDetail,
  mockVehicleUnavailableServiceDetail,
  toVehicleOperationHistoryRows
} from "./vehicle-data-core.ts";

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

test("vehicle operation history rows are filtered by internal bike id without exposing raw ids", () => {
  const rows = toVehicleOperationHistoryRows(
    [
      {
        id: "99999999-9999-4999-8999-999999999999",
        idx: 99,
        bikeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        operationStatus: "INSPECTION_REQUIRED",
        startedAt: "2026-04-30T01:00:00Z",
        endedAt: null,
        reason: "운영자 확인",
        memo: "브레이크 점검",
        changedBy: "11111111-1111-4111-8111-111111111111",
        createdAt: "2026-04-30T01:00:00Z",
        updatedAt: "2026-04-30T01:00:00Z"
      },
      {
        id: "88888888-8888-4888-8888-888888888888",
        idx: 100,
        bikeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        operationStatus: "READY",
        startedAt: "2026-04-29T01:00:00Z",
        endedAt: "2026-04-29T02:00:00Z",
        reason: "다른 차량",
        memo: null,
        changedBy: null,
        createdAt: "2026-04-29T01:00:00Z",
        updatedAt: "2026-04-29T02:00:00Z"
      }
    ],
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  );

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    endedAt: "진행 중",
    memo: "브레이크 점검",
    reason: "운영자 확인",
    startedAt: "2026-04-30 10:00",
    statusLabel: "점검 필요"
  });
  assert.equal("id" in rows[0], false);
  assert.equal("idx" in rows[0], false);
  assert.equal("bikeId" in rows[0], false);
  assert.equal("changedBy" in rows[0], false);
});

test("vehicle operation history loader scans later pages before declaring empty history", async () => {
  const requests = [];
  const rows = await loadVehicleOperationHistoryRows(
    async (params) => {
      requests.push(params);
      if (params.page === 0) {
        return {
          items: [
            {
              id: "88888888-8888-4888-8888-888888888888",
              idx: 100,
              bikeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              operationStatus: "READY",
              startedAt: "2026-04-29T01:00:00Z",
              endedAt: null,
              reason: "다른 차량",
              memo: null,
              changedBy: null,
              createdAt: "2026-04-29T01:00:00Z",
              updatedAt: "2026-04-29T01:00:00Z"
            }
          ],
          page: { hasNext: true, hasPrevious: false, number: 0, size: 100, totalItems: 2, totalPages: 2 }
        };
      }

      return {
        items: [
          {
            id: "99999999-9999-4999-8999-999999999999",
            idx: 99,
            bikeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            operationStatus: "IN_SERVICE",
            startedAt: "2026-04-30T00:00:00Z",
            endedAt: null,
            reason: "운영 투입",
            memo: "오전 교대",
            changedBy: null,
            createdAt: "2026-04-30T00:00:00Z",
            updatedAt: "2026-04-30T00:00:00Z"
          }
        ],
        page: { hasNext: false, hasPrevious: true, number: 1, size: 100, totalItems: 2, totalPages: 2 }
      };
    },
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  );

  assert.deepEqual(requests, [
    { page: 0, size: 100, sort: "idx,desc" },
    { page: 1, size: 100, sort: "idx,desc" }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].statusLabel, "운행 중");
});
