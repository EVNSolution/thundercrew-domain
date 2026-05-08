import assert from "node:assert/strict";
import test from "node:test";

import {
  ContractTemplateCommandPayloadError,
  toContractTemplateCreatePayload,
  toContractTemplateUpdatePayload
} from "./contract-template-command-payload.ts";

// CUSTOM category — keeps the legacy day/hour/minute payload shape that
// existed before Slice ④-3. The form encodes the legacy fields under the
// `customDuration*` names so the new SUBSCRIPTION/RENTAL paths can use the
// shorter `durationUnit` / `durationValue` names without colliding.
test("CUSTOM category create payload sums day/hour/minute and ignores client-supplied ids", () => {
  const formData = new FormData();
  formData.set("category", "CUSTOM");
  formData.set("name", "표준 12일 6시간");
  formData.set("customDurationMode", "limited");
  formData.set("customDurationDays", "12");
  formData.set("customDurationHours", "6");
  formData.set("customDurationMinutesPart", "30");
  formData.set("description", "운영자 생성 양식");
  formData.set("enabled", "true");
  formData.set("id", "99999999-9999-4999-8999-999999999999");
  formData.set("idx", "999");
  formData.set("contractTemplateId", "99999999-9999-4999-8999-999999999999");
  formData.set("systemTemplate", "true");

  assert.deepEqual(toContractTemplateCreatePayload(formData), {
    category: "CUSTOM",
    description: "운영자 생성 양식",
    durationMinutes: 17670,
    enabled: true,
    name: "표준 12일 6시간"
  });
});

test("CUSTOM category supports unlimited duration", () => {
  const formData = new FormData();
  formData.set("category", "CUSTOM");
  formData.set("name", "무제한 현장 계약");
  formData.set("customDurationMode", "unlimited");
  formData.set("customDurationDays", "12");
  formData.set("customDurationHours", "3");
  formData.set("description", "");
  formData.set("enabled", "false");

  assert.deepEqual(toContractTemplateCreatePayload(formData), {
    category: "CUSTOM",
    description: null,
    durationMinutes: null,
    enabled: false,
    name: "무제한 현장 계약"
  });
});

test("CUSTOM category update preserves blank description as clear command", () => {
  const formData = new FormData();
  formData.set("category", "CUSTOM");
  formData.set("name", "표준 13일");
  formData.set("customDurationMode", "limited");
  formData.set("customDurationDays", "13");
  formData.set("customDurationHours", "0");
  formData.set("customDurationMinutesPart", "0");
  formData.set("description", "");
  formData.set("enabled", "false");

  assert.deepEqual(toContractTemplateUpdatePayload(formData), {
    category: "CUSTOM",
    description: "",
    durationMinutes: 18720,
    enabled: false,
    name: "표준 13일"
  });
});

test("payload rejects blank name, zero CUSTOM duration, and invalid enabled state", () => {
  const formData = new FormData();
  formData.set("category", "CUSTOM");
  formData.set("name", "");
  formData.set("customDurationMode", "limited");
  formData.set("customDurationDays", "12");

  assert.throws(() => toContractTemplateCreatePayload(formData), ContractTemplateCommandPayloadError);

  formData.set("name", "0분 계약");
  formData.set("customDurationDays", "0");
  formData.set("customDurationHours", "0");
  formData.set("customDurationMinutesPart", "0");
  assert.throws(() => toContractTemplateCreatePayload(formData), ContractTemplateCommandPayloadError);

  formData.set("customDurationMinutesPart", "30");
  formData.set("enabled", "maybe");
  assert.throws(() => toContractTemplateUpdatePayload(formData), ContractTemplateCommandPayloadError);
});

// SUBSCRIPTION — fixed at MONTH × 12 with required returnType.
test("SUBSCRIPTION category forces MONTH × 12 and includes the structured fields", () => {
  const formData = new FormData();
  formData.set("category", "SUBSCRIPTION");
  formData.set("name", "구독 인수형 12개월 (보험 포함)");
  formData.set("returnType", "TAKEOVER");
  formData.set("includesInsurance", "true");
  formData.set("defaultInsuranceItemId", "22222222-2222-2222-2222-000000000001");
  formData.set("description", "");
  formData.set("enabled", "true");

  assert.deepEqual(toContractTemplateCreatePayload(formData), {
    category: "SUBSCRIPTION",
    defaultInsuranceItemId: "22222222-2222-2222-2222-000000000001",
    description: null,
    durationMinutes: 12 * 30 * 1440,
    durationUnit: "MONTH",
    durationValue: 12,
    enabled: true,
    includesInsurance: true,
    name: "구독 인수형 12개월 (보험 포함)",
    returnType: "TAKEOVER"
  });
});

test("SUBSCRIPTION rejects missing returnType", () => {
  const formData = new FormData();
  formData.set("category", "SUBSCRIPTION");
  formData.set("name", "잘못된 구독");
  formData.set("description", "");
  formData.set("enabled", "true");

  assert.throws(() => toContractTemplateCreatePayload(formData), ContractTemplateCommandPayloadError);
});

test("SUBSCRIPTION with insurance requires defaultInsuranceItemId", () => {
  const formData = new FormData();
  formData.set("category", "SUBSCRIPTION");
  formData.set("name", "구독·보험·아이템 누락");
  formData.set("returnType", "RETURN");
  formData.set("includesInsurance", "true");

  assert.throws(() => toContractTemplateCreatePayload(formData), ContractTemplateCommandPayloadError);
});

// RENTAL — durationUnit must be DAY/WEEK/MONTH/QUARTER/HALF_YEAR.
test("RENTAL category accepts allowed duration units", () => {
  const formData = new FormData();
  formData.set("category", "RENTAL");
  formData.set("name", "단기 렌탈 일주일");
  formData.set("returnType", "RETURN");
  formData.set("durationUnit", "WEEK");
  formData.set("durationValue", "1");
  formData.set("description", "");
  formData.set("enabled", "true");

  assert.deepEqual(toContractTemplateCreatePayload(formData), {
    category: "RENTAL",
    defaultInsuranceItemId: null,
    description: null,
    durationMinutes: 7 * 1440,
    durationUnit: "WEEK",
    durationValue: 1,
    enabled: true,
    includesInsurance: false,
    name: "단기 렌탈 일주일",
    returnType: "RETURN"
  });
});

test("RENTAL rejects YEAR duration unit", () => {
  const formData = new FormData();
  formData.set("category", "RENTAL");
  formData.set("name", "잘못된 렌탈·년단위");
  formData.set("returnType", "TAKEOVER");
  formData.set("durationUnit", "YEAR");
  formData.set("durationValue", "1");

  assert.throws(() => toContractTemplateCreatePayload(formData), ContractTemplateCommandPayloadError);
});

test("RENTAL rejects zero duration value", () => {
  const formData = new FormData();
  formData.set("category", "RENTAL");
  formData.set("name", "잘못된 렌탈·기간0");
  formData.set("returnType", "RETURN");
  formData.set("durationUnit", "DAY");
  formData.set("durationValue", "0");

  assert.throws(() => toContractTemplateCreatePayload(formData), ContractTemplateCommandPayloadError);
});
