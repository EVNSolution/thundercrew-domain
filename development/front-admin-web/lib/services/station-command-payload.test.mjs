import assert from "node:assert/strict";
import test from "node:test";

import {
  StationCommandPayloadError,
  toBatteryStationCountPayload,
  toBatteryStationCreatePayload,
  toBatteryStationUpdatePayload
} from "./station-command-payload.ts";

test("battery station create payload uses operator fields and ignores direct raw ID field names", () => {
  const formData = new FormData();
  formData.set("name", "강남 교체 스테이션");
  formData.set("address", "서울 강남구 테헤란로 152");
  formData.set("latitude", "37.5007");
  formData.set("longitude", "127.0364");
  formData.set("status", "ACTIVE");
  formData.set("maxBatteryCapacity", "48");
  formData.set("currentBatteryCount", "41");
  formData.set("availableBatteryCount", "31");
  formData.set("memo", "B1 우측 출입구");
  formData.set("stationId", "99999999-9999-4999-8999-999999999999");
  formData.set("batteryStationId", "99999999-9999-4999-8999-999999999999");

  assert.deepEqual(toBatteryStationCreatePayload(formData), {
    address: "서울 강남구 테헤란로 152",
    availableBatteryCount: 31,
    currentBatteryCount: 41,
    latitude: 37.5007,
    longitude: 127.0364,
    maxBatteryCapacity: 48,
    memo: "B1 우측 출입구",
    name: "강남 교체 스테이션",
    status: "ACTIVE"
  });
});

test("battery station update payload excludes count and system fields", () => {
  const formData = new FormData();
  formData.set("name", "강남 교체 스테이션");
  formData.set("address", "서울 강남구 테헤란로 153");
  formData.set("latitude", "37.5008");
  formData.set("longitude", "127.0365");
  formData.set("status", "MAINTENANCE");
  formData.set("memo", "주소 보정");
  formData.set("maxBatteryCapacity", "99");
  formData.set("stationId", "99999999-9999-4999-8999-999999999999");

  assert.deepEqual(toBatteryStationUpdatePayload(formData), {
    address: "서울 강남구 테헤란로 153",
    latitude: 37.5008,
    longitude: 127.0365,
    memo: "주소 보정",
    name: "강남 교체 스테이션",
    status: "MAINTENANCE"
  });
});

test("battery station count payload is separated from station metadata", () => {
  const formData = new FormData();
  formData.set("maxBatteryCapacity", "48");
  formData.set("currentBatteryCount", "38");
  formData.set("availableBatteryCount", "28");
  formData.set("reason", "출고");
  formData.set("memo", "재고 보정");
  formData.set("name", "무시할 이름");
  formData.set("stationId", "99999999-9999-4999-8999-999999999999");

  assert.deepEqual(toBatteryStationCountPayload(formData), {
    availableBatteryCount: 28,
    currentBatteryCount: 38,
    maxBatteryCapacity: 48,
    memo: "재고 보정",
    reason: "출고"
  });
});

test("battery station payloads reject invalid statuses, coordinates, and count ordering", () => {
  const formData = new FormData();
  formData.set("name", "강남 교체 스테이션");
  formData.set("address", "서울 강남구 테헤란로 152");
  formData.set("latitude", "91");
  formData.set("longitude", "127.0364");
  formData.set("status", "ACTIVE");
  formData.set("maxBatteryCapacity", "48");
  formData.set("currentBatteryCount", "41");
  formData.set("availableBatteryCount", "31");

  assert.throws(() => toBatteryStationCreatePayload(formData), StationCommandPayloadError);

  formData.set("latitude", "37.5007");
  formData.set("status", "운영 중");
  assert.throws(() => toBatteryStationCreatePayload(formData), StationCommandPayloadError);

  formData.set("status", "ACTIVE");
  formData.set("availableBatteryCount", "42");
  assert.throws(() => toBatteryStationCreatePayload(formData), StationCommandPayloadError);
});
