import assert from "node:assert/strict";
import test from "node:test";

import {
  mockBikeDeviceInstallationUnavailableServiceDetail,
  mockDeviceUnavailableServiceDetail,
  toDeviceList,
  toFrontendBikeDeviceInstallation
} from "./device-data-core.ts";

test("toDeviceList maps service devices to frontend device models", () => {
  const devices = toDeviceList([
    {
      id: "11111111-1111-4111-8111-111111111111",
      idx: 1,
      deviceUid: "TDEV-SEOUL-4821",
      manufacturer: "ThunderDevice",
      modelName: "TD-100",
      enabled: true,
      memo: "운영 단말",
      createdAt: "2026-04-30T00:00:00Z",
      updatedAt: "2026-04-30T00:00:00Z"
    }
  ]);

  assert.deepEqual(devices[0], {
    createdAt: "2026-04-30T00:00:00Z",
    deviceUid: "TDEV-SEOUL-4821",
    enabled: true,
    id: "11111111-1111-4111-8111-111111111111",
    idx: 1,
    manufacturer: "ThunderDevice",
    memo: "운영 단말",
    modelName: "TD-100",
    slug: "11111111-1111-4111-8111-111111111111",
    source: "service-ops",
    updatedAt: "2026-04-30T00:00:00Z"
  });
});

test("toFrontendBikeDeviceInstallation hydrates vehicle and device labels", () => {
  const installation = toFrontendBikeDeviceInstallation(
    {
      id: "22222222-2222-4222-8222-222222222222",
      idx: 2,
      bikeId: "33333333-3333-4333-8333-333333333333",
      deviceId: "44444444-4444-4444-8444-444444444444",
      installedAt: "2026-04-30T00:00:00Z",
      removedAt: null,
      memo: "설치",
      createdAt: "2026-04-30T00:00:00Z",
      updatedAt: "2026-04-30T00:00:00Z"
    },
    {
      devices: new Map([["44444444-4444-4444-8444-444444444444", { deviceUid: "TDEV-001", label: "TDEV-001 · TD-100" }]]),
      vehicles: new Map([["33333333-3333-4333-8333-333333333333", { model: "NIU NQi Cargo", plateNumber: "서울바4821", status: "대기" }]])
    }
  );

  assert.equal(installation.bikeLabel, "서울바4821 · NIU NQi Cargo");
  assert.equal(installation.deviceLabel, "TDEV-001 · TD-100");
  assert.equal(installation.status, "설치 중");
});

test("removed bike-device installation displays removed status", () => {
  const installation = toFrontendBikeDeviceInstallation(
    {
      id: "22222222-2222-4222-8222-222222222222",
      idx: 2,
      bikeId: "33333333-3333-4333-8333-333333333333",
      deviceId: "44444444-4444-4444-8444-444444444444",
      installedAt: "2026-04-30T00:00:00Z",
      removedAt: "2026-05-01T00:00:00Z",
      memo: null,
      createdAt: "2026-04-30T00:00:00Z",
      updatedAt: "2026-05-01T00:00:00Z"
    },
    { devices: new Map(), vehicles: new Map() }
  );

  assert.equal(installation.status, "제거됨");
  assert.match(installation.bikeLabel, /알 수 없는 차량/);
  assert.match(installation.deviceLabel, /알 수 없는 단말/);
});

test("UUID service detail fallback remains visible when API is unavailable", () => {
  const device = mockDeviceUnavailableServiceDetail("11111111-1111-4111-8111-111111111111", [], "no service");
  const installation = mockBikeDeviceInstallationUnavailableServiceDetail("22222222-2222-4222-8222-222222222222", [], "no service");

  assert.equal(device.device.slug, "11111111-1111-4111-8111-111111111111");
  assert.equal(device.notice, "no service");
  assert.equal(installation.installation.slug, "22222222-2222-4222-8222-222222222222");
  assert.equal(installation.notice, "no service");
});
