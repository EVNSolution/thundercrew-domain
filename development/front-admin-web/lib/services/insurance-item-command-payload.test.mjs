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

// New Slice ④-4 fields — category, coverageType, defaultDurationUnit/Value.

test("insurance item payload includes category/coverage/duration when provided together", () => {
  const formData = new FormData();
  formData.set("name", "유상운송종합보험");
  formData.set("description", "메인 보험");
  formData.set("enabled", "true");
  formData.set("category", "PRIMARY");
  formData.set("coverageType", "GENERAL_PAID_TRANSPORT");
  formData.set("defaultDurationUnit", "MONTH");
  formData.set("defaultDurationValue", "12");

  assert.deepEqual(toInsuranceItemCreatePayload(formData), {
    name: "유상운송종합보험",
    description: "메인 보험",
    enabled: true,
    category: "PRIMARY",
    coverageType: "GENERAL_PAID_TRANSPORT",
    defaultDurationUnit: "MONTH",
    defaultDurationValue: 12
  });
});

test("insurance item payload omits classification fields when none supplied", () => {
  const formData = new FormData();
  formData.set("name", "라이더 기본 보험");
  formData.set("description", "");
  formData.set("enabled", "true");
  // No category / coverageType / duration fields → partial stays empty so the
  // legacy create payload shape is preserved.

  assert.deepEqual(toInsuranceItemCreatePayload(formData), {
    name: "라이더 기본 보험",
    description: null,
    enabled: true
  });
});

test("insurance item payload rejects half-supplied default duration", () => {
  const formData = new FormData();
  formData.set("name", "잘못된 기본 기간");
  formData.set("enabled", "true");
  formData.set("category", "ADDON");
  formData.set("coverageType", "HOURLY");
  formData.set("defaultDurationUnit", "HOUR");
  // defaultDurationValue intentionally missing → should throw.

  assert.throws(() => toInsuranceItemCreatePayload(formData), InsuranceItemCommandPayloadError);
});

test("insurance item payload rejects unknown category, coverage type, or duration unit", () => {
  const cases = [
    { field: "category", value: "BOGUS" },
    { field: "coverageType", value: "BOGUS_TYPE" },
    { field: "defaultDurationUnit", value: "DECADE" }
  ];

  for (const { field, value } of cases) {
    const formData = new FormData();
    formData.set("name", "유효한 이름");
    formData.set("enabled", "true");
    formData.set(field, value);
    if (field === "defaultDurationUnit") {
      formData.set("defaultDurationValue", "1");
    }
    assert.throws(
      () => toInsuranceItemCreatePayload(formData),
      InsuranceItemCommandPayloadError,
      `${field}=${value} should be rejected`
    );
  }
});

test("insurance item payload rejects zero or non-positive default duration value", () => {
  const formData = new FormData();
  formData.set("name", "유효한 이름");
  formData.set("enabled", "true");
  formData.set("category", "ADDON");
  formData.set("defaultDurationUnit", "DAY");
  formData.set("defaultDurationValue", "0");

  assert.throws(() => toInsuranceItemCreatePayload(formData), InsuranceItemCommandPayloadError);
});
