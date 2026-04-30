import assert from "node:assert/strict";
import test from "node:test";

import {
  DeviceCommandPayloadError,
  toBikeDeviceInstallationCreatePayload,
  toBikeDeviceInstallationRemovePayload,
  toDeviceCreatePayload,
  toDeviceUpdatePayload
} from "./device-command-payload.ts";

test("device create/update payloads keep operator fields and ignore direct relationship ids", () => {
  const formData = new FormData();
  formData.set("deviceUid", "TDEV-SEOUL-4821");
  formData.set("manufacturer", "ThunderDevice");
  formData.set("modelName", "TD-100");
  formData.set("enabled", "true");
  formData.set("memo", "운영 단말");
  formData.set("deviceId", "99999999-9999-4999-8999-999999999999");
  formData.set("bikeId", "99999999-9999-4999-8999-999999999999");
  formData.set("installationId", "99999999-9999-4999-8999-999999999999");

  const expected = {
    deviceUid: "TDEV-SEOUL-4821",
    enabled: true,
    manufacturer: "ThunderDevice",
    memo: "운영 단말",
    modelName: "TD-100"
  };
  assert.deepEqual(toDeviceCreatePayload(formData), expected);
  assert.deepEqual(toDeviceUpdatePayload(formData), expected);
});

test("device update preserves blank optional strings as clear commands", () => {
  const formData = new FormData();
  formData.set("deviceUid", "TDEV-SEOUL-4821");
  formData.set("manufacturer", "");
  formData.set("modelName", "");
  formData.set("memo", "");
  formData.set("enabled", "false");

  assert.deepEqual(toDeviceUpdatePayload(formData), {
    deviceUid: "TDEV-SEOUL-4821",
    enabled: false,
    manufacturer: "",
    memo: "",
    modelName: ""
  });
});

test("device create treats blank optional strings as null", () => {
  const formData = new FormData();
  formData.set("deviceUid", "TDEV-SEOUL-4821");
  formData.set("manufacturer", "");
  formData.set("modelName", "");
  formData.set("memo", "");
  formData.set("enabled", "true");

  assert.deepEqual(toDeviceCreatePayload(formData), {
    deviceUid: "TDEV-SEOUL-4821",
    enabled: true,
    manufacturer: null,
    memo: null,
    modelName: null
  });
});

test("device payloads reject blank uid and invalid enabled value", () => {
  const formData = new FormData();
  formData.set("deviceUid", "");
  formData.set("enabled", "true");

  assert.throws(() => toDeviceCreatePayload(formData), DeviceCommandPayloadError);

  formData.set("deviceUid", "TDEV-SEOUL-4821");
  formData.set("enabled", "maybe");
  assert.throws(() => toDeviceUpdatePayload(formData), DeviceCommandPayloadError);
});

test("bike-device installation create payload uses selector fields and ignores raw direct ID names", () => {
  const formData = new FormData();
  formData.set("vehicleSelection", "11111111-1111-4111-8111-111111111111");
  formData.set("deviceSelection", "22222222-2222-4222-8222-222222222222");
  formData.set("installedAt", "2026-04-30T10:30");
  formData.set("memo", "설치 메모");
  formData.set("bikeId", "99999999-9999-4999-8999-999999999999");
  formData.set("deviceId", "99999999-9999-4999-8999-999999999999");
  formData.set("installationId", "99999999-9999-4999-8999-999999999999");

  assert.deepEqual(toBikeDeviceInstallationCreatePayload(formData), {
    bikeId: "11111111-1111-4111-8111-111111111111",
    deviceId: "22222222-2222-4222-8222-222222222222",
    installedAt: "2026-04-30T01:30:00.000Z",
    memo: "설치 메모"
  });
});

test("bike-device installation remove payload preserves blank memo as clear command", () => {
  const formData = new FormData();
  formData.set("removedAt", "");
  formData.set("memo", "");
  formData.set("deviceId", "99999999-9999-4999-8999-999999999999");

  assert.deepEqual(toBikeDeviceInstallationRemovePayload(formData), {
    memo: "",
    removedAt: null
  });
});

test("bike-device installation payloads reject blank selectors and invalid dates", () => {
  const formData = new FormData();
  formData.set("vehicleSelection", "서울바4821");
  formData.set("deviceSelection", "22222222-2222-4222-8222-222222222222");
  formData.set("installedAt", "2026-04-30T10:30");

  assert.throws(() => toBikeDeviceInstallationCreatePayload(formData), DeviceCommandPayloadError);

  formData.set("vehicleSelection", "11111111-1111-4111-8111-111111111111");
  formData.set("installedAt", "not-a-date");
  assert.throws(() => toBikeDeviceInstallationCreatePayload(formData), DeviceCommandPayloadError);

  formData.set("installedAt", "2026-04-30T10:30");
  formData.set("deviceSelection", "");
  assert.throws(() => toBikeDeviceInstallationCreatePayload(formData), DeviceCommandPayloadError);
});
