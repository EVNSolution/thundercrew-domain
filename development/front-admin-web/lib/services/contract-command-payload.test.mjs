import assert from "node:assert/strict";
import test from "node:test";

import {
  ContractCommandPayloadError,
  toRiderBikeContractCreatePayload,
  toRiderBikeContractMemoPayload,
  toRiderBikeContractTerminatePayload
} from "./contract-command-payload.ts";

test("contract create payload uses selector fields and ignores raw direct ID field names", () => {
  const formData = new FormData();
  formData.set("riderSelection", "11111111-1111-4111-8111-111111111111");
  formData.set("bikeSelection", "22222222-2222-4222-8222-222222222222");
  formData.set("contractTemplateSelection", "33333333-3333-4333-8333-333333333333");
  formData.set("startAt", "2026-05-01T09:30");
  formData.set("memo", "선택 UI 기반 계약");
  formData.set("riderId", "99999999-9999-4999-8999-999999999999");
  formData.set("bikeId", "99999999-9999-4999-8999-999999999999");
  formData.set("contractTemplateId", "99999999-9999-4999-8999-999999999999");

  const payload = toRiderBikeContractCreatePayload(formData);

  assert.deepEqual(payload, {
    bikeId: "22222222-2222-4222-8222-222222222222",
    contractTemplateId: "33333333-3333-4333-8333-333333333333",
    memo: "선택 UI 기반 계약",
    riderId: "11111111-1111-4111-8111-111111111111",
    startAt: "2026-05-01T00:30:00.000Z"
  });
});

test("contract create payload rejects blank or non-uuid selector values", () => {
  const formData = new FormData();
  formData.set("riderSelection", "kim-minjun");
  formData.set("bikeSelection", "22222222-2222-4222-8222-222222222222");
  formData.set("contractTemplateSelection", "33333333-3333-4333-8333-333333333333");
  formData.set("startAt", "2026-05-01T09:30");

  assert.throws(() => toRiderBikeContractCreatePayload(formData), ContractCommandPayloadError);

  formData.set("riderSelection", "11111111-1111-4111-8111-111111111111");
  formData.set("bikeSelection", "");

  assert.throws(() => toRiderBikeContractCreatePayload(formData), ContractCommandPayloadError);
});

test("contract memo and terminate payloads keep state-specific fields only", () => {
  const memoForm = new FormData();
  memoForm.set("memo", "메모 수정");
  memoForm.set("riderId", "11111111-1111-4111-8111-111111111111");
  assert.deepEqual(toRiderBikeContractMemoPayload(memoForm), { memo: "메모 수정" });

  const terminateForm = new FormData();
  terminateForm.set("terminatedAt", "2026-05-10T18:00");
  terminateForm.set("terminatedReason", "운영 종료");
  terminateForm.set("contractId", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

  assert.deepEqual(toRiderBikeContractTerminatePayload(terminateForm), {
    terminatedAt: "2026-05-10T09:00:00.000Z",
    terminatedReason: "운영 종료"
  });
});
