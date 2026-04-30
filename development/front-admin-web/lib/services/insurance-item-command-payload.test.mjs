import assert from "node:assert/strict";
import test from "node:test";

import {
  InsuranceItemCommandPayloadError,
  toInsuranceItemCreatePayload,
  toInsuranceItemUpdatePayload
} from "./insurance-item-command-payload.ts";

test("insurance item create/update payloads keep operator fields only and ignore direct ids", () => {
  const formData = new FormData();
  formData.set("name", "라이더 기본 보험");
  formData.set("description", "운영자 보험 항목");
  formData.set("enabled", "true");
  formData.set("id", "99999999-9999-4999-8999-999999999999");
  formData.set("idx", "999");
  formData.set("insuranceItemId", "99999999-9999-4999-8999-999999999999");
  formData.set("riderId", "99999999-9999-4999-8999-999999999999");

  const expected = {
    description: "운영자 보험 항목",
    enabled: true,
    name: "라이더 기본 보험"
  };
  assert.deepEqual(toInsuranceItemCreatePayload(formData), expected);
  assert.deepEqual(toInsuranceItemUpdatePayload(formData), expected);
});

test("insurance item update preserves blank description as clear command", () => {
  const formData = new FormData();
  formData.set("name", "라이더 기본 보험");
  formData.set("description", "");
  formData.set("enabled", "false");

  assert.deepEqual(toInsuranceItemUpdatePayload(formData), {
    description: "",
    enabled: false,
    name: "라이더 기본 보험"
  });
});

test("insurance item create treats blank optional description as null", () => {
  const formData = new FormData();
  formData.set("name", "라이더 기본 보험");
  formData.set("description", "");
  formData.set("enabled", "true");

  assert.deepEqual(toInsuranceItemCreatePayload(formData), {
    description: null,
    enabled: true,
    name: "라이더 기본 보험"
  });
});

test("insurance item payloads reject blank name and invalid enabled value", () => {
  const formData = new FormData();
  formData.set("name", "");
  formData.set("enabled", "true");

  assert.throws(() => toInsuranceItemCreatePayload(formData), InsuranceItemCommandPayloadError);

  formData.set("name", "라이더 기본 보험");
  formData.set("enabled", "maybe");
  assert.throws(() => toInsuranceItemUpdatePayload(formData), InsuranceItemCommandPayloadError);
});
