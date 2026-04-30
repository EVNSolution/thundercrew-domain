import assert from "node:assert/strict";
import test from "node:test";

import {
  VehicleCommandPayloadError,
  toOperationStatus,
  toVehicleCreatePayload,
  toVehicleStatusPayload,
  toVehicleUpdatePayload
} from "./vehicle-command-payload.ts";

test("toOperationStatus rejects invalid or missing status instead of defaulting to READY", () => {
  assert.equal(toOperationStatus("READY"), "READY");
  assert.throws(() => toOperationStatus("BROKEN"), VehicleCommandPayloadError);
  assert.throws(() => toOperationStatus(null), VehicleCommandPayloadError);
});

test("vehicle command payloads expose only service-owned bike fields", () => {
  const formData = new FormData();
  formData.set("plateNumber", "서울A-1001");
  formData.set("vin", "VIN-BIKE-001");
  formData.set("modelName", "Thunder M1");
  formData.set("operationStatus", "IN_SERVICE");
  formData.set("memo", "운영 메모");
  formData.set("bikeId", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  formData.set("riderId", "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr");
  formData.set("deviceId", "dddddddd-dddd-4ddd-8ddd-dddddddddddd");

  const createPayload = toVehicleCreatePayload(formData);
  const updatePayload = toVehicleUpdatePayload(formData);
  const statusPayload = toVehicleStatusPayload(formData);

  assert.deepEqual(Object.keys(createPayload).sort(), ["memo", "modelName", "operationStatus", "plateNumber", "vin"]);
  assert.deepEqual(Object.keys(updatePayload).sort(), ["memo", "modelName", "plateNumber", "vin"]);
  assert.deepEqual(Object.keys(statusPayload).sort(), ["memo", "operationStatus", "reason"]);
  assert.equal("bikeId" in createPayload, false);
  assert.equal("riderId" in createPayload, false);
  assert.equal("deviceId" in createPayload, false);
  assert.equal("operationStatus" in updatePayload, false);
});

test("vehicle command payloads reject blank required vehicle fields", () => {
  const formData = new FormData();
  formData.set("plateNumber", " ");
  formData.set("vin", "VIN-BIKE-001");
  formData.set("operationStatus", "READY");

  assert.throws(() => toVehicleCreatePayload(formData), VehicleCommandPayloadError);

  formData.set("plateNumber", "서울A-1001");
  formData.set("vin", "");

  assert.throws(() => toVehicleUpdatePayload(formData), VehicleCommandPayloadError);
});
