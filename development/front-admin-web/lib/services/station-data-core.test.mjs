import assert from "node:assert/strict";
import test from "node:test";

import {
  mockStationUnconfiguredServiceDetail,
  mockStationUnavailableServiceDetail,
  normalizeMockStation
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
  assert.match(missingBaseUrl?.notice ?? "", /SERVICE_OPS_API_BASE_URL/);
});
