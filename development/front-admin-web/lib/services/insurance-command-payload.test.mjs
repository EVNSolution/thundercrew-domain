import assert from "node:assert/strict";
import test from "node:test";

import {
  InsuranceCommandPayloadError,
  toRiderInsuranceCreatePayload,
  toRiderInsuranceUpdatePayload
} from "./insurance-command-payload.ts";

test("rider insurance create payload uses selector fields and ignores direct raw ID field names", () => {
  const formData = new FormData();
  formData.set("riderSelection", "11111111-1111-4111-8111-111111111111");
  formData.set("insuranceItemSelection", "22222222-2222-4222-8222-222222222222");
  formData.set("enabled", "true");
  formData.set("memo", "보험 연결 메모");
  formData.set("riderId", "99999999-9999-4999-8999-999999999999");
  formData.set("insuranceItemId", "99999999-9999-4999-8999-999999999999");
  formData.set("insuranceId", "99999999-9999-4999-8999-999999999999");

  assert.deepEqual(toRiderInsuranceCreatePayload(formData), {
    enabled: true,
    insuranceItemId: "22222222-2222-4222-8222-222222222222",
    memo: "보험 연결 메모",
    riderId: "11111111-1111-4111-8111-111111111111"
  });
});

test("rider insurance payloads reject blank or non-uuid selector values", () => {
  const formData = new FormData();
  formData.set("riderSelection", "kim-minjun");
  formData.set("insuranceItemSelection", "22222222-2222-4222-8222-222222222222");

  assert.throws(() => toRiderInsuranceCreatePayload(formData), InsuranceCommandPayloadError);

  formData.set("riderSelection", "11111111-1111-4111-8111-111111111111");
  formData.set("insuranceItemSelection", "");

  assert.throws(() => toRiderInsuranceCreatePayload(formData), InsuranceCommandPayloadError);
});

test("rider insurance update payload keeps memo and enabled only", () => {
  const formData = new FormData();
  formData.set("memo", "비활성 전환");
  formData.set("enabled", "false");
  formData.set("riderId", "11111111-1111-4111-8111-111111111111");
  formData.set("insuranceItemId", "22222222-2222-4222-8222-222222222222");

  assert.deepEqual(toRiderInsuranceUpdatePayload(formData), {
    enabled: false,
    memo: "비활성 전환"
  });
});
