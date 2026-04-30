import assert from "node:assert/strict";
import test from "node:test";

import {
  ContractTemplateCommandPayloadError,
  toContractTemplateCreatePayload,
  toContractTemplateUpdatePayload
} from "./contract-template-command-payload.ts";

test("contract template create payload keeps operator fields only and ignores direct ids", () => {
  const formData = new FormData();
  formData.set("name", "표준 12일 6시간");
  formData.set("durationMode", "limited");
  formData.set("durationDays", "12");
  formData.set("durationHours", "6");
  formData.set("durationMinutesPart", "30");
  formData.set("description", "운영자 생성 양식");
  formData.set("enabled", "true");
  formData.set("id", "99999999-9999-4999-8999-999999999999");
  formData.set("idx", "999");
  formData.set("contractTemplateId", "99999999-9999-4999-8999-999999999999");
  formData.set("systemTemplate", "true");

  assert.deepEqual(toContractTemplateCreatePayload(formData), {
    description: "운영자 생성 양식",
    durationMinutes: 17670,
    enabled: true,
    name: "표준 12일 6시간"
  });
});

test("contract template payload supports unlimited duration", () => {
  const formData = new FormData();
  formData.set("name", "무제한 현장 계약");
  formData.set("durationMode", "unlimited");
  formData.set("durationDays", "12");
  formData.set("durationHours", "3");
  formData.set("description", "");
  formData.set("enabled", "false");

  assert.deepEqual(toContractTemplateCreatePayload(formData), {
    description: null,
    durationMinutes: null,
    enabled: false,
    name: "무제한 현장 계약"
  });
});

test("contract template update preserves blank description as clear command", () => {
  const formData = new FormData();
  formData.set("name", "표준 13일");
  formData.set("durationMode", "limited");
  formData.set("durationDays", "13");
  formData.set("durationHours", "0");
  formData.set("durationMinutesPart", "0");
  formData.set("description", "");
  formData.set("enabled", "false");

  assert.deepEqual(toContractTemplateUpdatePayload(formData), {
    description: "",
    durationMinutes: 18720,
    enabled: false,
    name: "표준 13일"
  });
});

test("contract template payload rejects blank name, zero duration, and invalid enabled state", () => {
  const formData = new FormData();
  formData.set("name", "");
  formData.set("durationMode", "limited");
  formData.set("durationDays", "12");

  assert.throws(() => toContractTemplateCreatePayload(formData), ContractTemplateCommandPayloadError);

  formData.set("name", "0분 계약");
  formData.set("durationDays", "0");
  formData.set("durationHours", "0");
  formData.set("durationMinutesPart", "0");
  assert.throws(() => toContractTemplateCreatePayload(formData), ContractTemplateCommandPayloadError);

  formData.set("durationMinutesPart", "30");
  formData.set("enabled", "maybe");
  assert.throws(() => toContractTemplateUpdatePayload(formData), ContractTemplateCommandPayloadError);
});
