import assert from "node:assert/strict";
import test from "node:test";

import {
  loadStationBatteryCountLogRows,
  mockStationUnconfiguredServiceDetail,
  mockStationUnavailableServiceDetail,
  normalizeMockStation,
  toStationBatteryCountLogRows
} from "./station-data-core.ts";

const mockStations = [
  {
    address: "서울 강남구 테헤란로 152",
    batteryCount: 41,
    latitude: 37.5007,
    longitude: 127.0364,
    name: "강남 교체 스테이션",
    replaceableCount: 31,
    slug: "gangnam-station",
    status: "운영 중"
  }
];

test("normalizeMockStation derives available n/m and capacity fields", () => {
  const station = normalizeMockStation(mockStations[0]);

  assert.equal(station.maxBatteryCapacity, 41);
  assert.equal(station.currentBatteryCount, 41);
  assert.equal(station.availableBatteryCount, 31);
  assert.equal(station.availableBatteryLabel, "31/41");
  assert.equal(station.capacityPercentage, 100);
  assert.equal(station.source, "mock");
});

test("UUID station detail falls back to visible mock detail when service API is unavailable", () => {
  const missingSession = mockStationUnavailableServiceDetail(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mockStations,
    "서비스 API 세션 쿠키가 없어 mock 스테이션 상세를 표시합니다."
  );
  const missingBaseUrl = mockStationUnconfiguredServiceDetail("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", mockStations);

  assert.equal(missingSession?.source, "mock");
  assert.equal(missingSession?.station.slug, "gangnam-station");
  assert.equal(missingBaseUrl?.source, "mock");
  assert.equal(missingBaseUrl?.station.slug, "gangnam-station");
});

test("station battery count log rows are filtered by internal station id without exposing raw ids", () => {
  const rows = toStationBatteryCountLogRows(
    [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        idx: 101,
        stationId: "55555555-5555-4555-8555-555555555555",
        beforeMaxBatteryCapacity: 48,
        afterMaxBatteryCapacity: 48,
        beforeCurrentBatteryCount: 41,
        afterCurrentBatteryCount: 38,
        beforeAvailableBatteryCount: 31,
        afterAvailableBatteryCount: 28,
        reason: "출고",
        memo: "재고 보정",
        changedAt: "2026-04-30T02:00:00Z",
        changedBy: "11111111-1111-4111-8111-111111111111",
        createdAt: "2026-04-30T02:00:00Z",
        updatedAt: "2026-04-30T02:00:00Z"
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        idx: 102,
        stationId: "66666666-6666-4666-8666-666666666666",
        beforeMaxBatteryCapacity: 20,
        afterMaxBatteryCapacity: 20,
        beforeCurrentBatteryCount: 10,
        afterCurrentBatteryCount: 9,
        beforeAvailableBatteryCount: 5,
        afterAvailableBatteryCount: 4,
        reason: "다른 스테이션",
        memo: null,
        changedAt: "2026-04-30T03:00:00Z",
        changedBy: null,
        createdAt: "2026-04-30T03:00:00Z",
        updatedAt: "2026-04-30T03:00:00Z"
      }
    ],
    "55555555-5555-4555-8555-555555555555"
  );

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    availableChange: "31 → 28",
    changedAt: "2026-04-30 11:00",
    currentChange: "41 → 38",
    maxChange: "48 → 48",
    memo: "재고 보정",
    reason: "출고"
  });
  assert.equal("id" in rows[0], false);
  assert.equal("idx" in rows[0], false);
  assert.equal("stationId" in rows[0], false);
  assert.equal("changedBy" in rows[0], false);
});

test("station battery count log loader scans later pages before declaring empty history", async () => {
  const requests = [];
  const rows = await loadStationBatteryCountLogRows(
    async (params) => {
      requests.push(params);
      if (params.page === 0) {
        return {
          items: [
            {
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              idx: 102,
              stationId: "66666666-6666-4666-8666-666666666666",
              beforeMaxBatteryCapacity: 20,
              afterMaxBatteryCapacity: 20,
              beforeCurrentBatteryCount: 10,
              afterCurrentBatteryCount: 9,
              beforeAvailableBatteryCount: 5,
              afterAvailableBatteryCount: 4,
              reason: "다른 스테이션",
              memo: null,
              changedAt: "2026-04-30T03:00:00Z",
              changedBy: null,
              createdAt: "2026-04-30T03:00:00Z",
              updatedAt: "2026-04-30T03:00:00Z"
            }
          ],
          page: { hasNext: true, hasPrevious: false, number: 0, size: 100, totalItems: 2, totalPages: 2 }
        };
      }

      return {
        items: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            idx: 101,
            stationId: "55555555-5555-4555-8555-555555555555",
            beforeMaxBatteryCapacity: 48,
            afterMaxBatteryCapacity: 48,
            beforeCurrentBatteryCount: 41,
            afterCurrentBatteryCount: 38,
            beforeAvailableBatteryCount: 31,
            afterAvailableBatteryCount: 28,
            reason: "출고",
            memo: "재고 보정",
            changedAt: "2026-04-30T02:00:00Z",
            changedBy: null,
            createdAt: "2026-04-30T02:00:00Z",
            updatedAt: "2026-04-30T02:00:00Z"
          }
        ],
        page: { hasNext: false, hasPrevious: true, number: 1, size: 100, totalItems: 2, totalPages: 2 }
      };
    },
    "55555555-5555-4555-8555-555555555555"
  );

  assert.deepEqual(requests, [
    { page: 0, size: 100, sort: "idx,desc" },
    { page: 1, size: 100, sort: "idx,desc" }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].availableChange, "31 → 28");
});
